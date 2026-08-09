import { createClient } from "npm:@supabase/supabase-js@2";
import { isAdminPassword } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-password",
};


function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function slugify(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function getUniqueSlug(supabase: ReturnType<typeof createClient>, baseSlug: string) {
  let candidate = baseSlug;
  for (let attempt = 2; attempt <= 50; attempt++) {
    const { data, error } = await supabase
      .from("reseller_links")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;

    const suffix = `-${attempt}`;
    candidate = `${baseSlug.slice(0, 60 - suffix.length)}${suffix}`;
  }
  throw new Error("Não foi possível gerar um link único para este revendedor");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const pwd = req.headers.get("x-admin-password");
    if (!isAdminPassword(pwd)) return unauthorized();

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    switch (action) {
      // -------- Links --------
      case "list-links": {
        const { data, error } = await supabase
          .from("reseller_links")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return ok({ links: data || [] });
      }

      case "create-link": {
        const baseSlug = slugify(body.slug || body.display_name || "");
        if (!baseSlug) return ok({ error: "slug inválido" }, 400);
        const customSlug = Boolean(String(body.slug || "").trim());
        const slug = customSlug ? baseSlug : await getUniqueSlug(supabase, baseSlug);
        if (customSlug) {
          const { data: existing, error: existingError } = await supabase
            .from("reseller_links")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();
          if (existingError) throw existingError;
          if (existing) return ok({ error: `Já existe um revendedor com o link "${slug}". Use outro slug.` }, 400);
        }
        const price = Number(body.price_per_credit ?? 11);
        const minC = Number(body.min_credits ?? 10);
        const maxC = Number(body.max_credits ?? 30);
        const baseCredits = Number(body.credits ?? minC);
        const payload = {
          slug,
          display_name: String(body.display_name || "").trim(),
          warez_username: String(body.warez_username || "").trim(),
          warez_user_id: Number(body.warez_user_id),
          credits: baseCredits,
          amount: Number(body.amount ?? baseCredits * price),
          price_per_credit: price,
          min_credits: minC,
          max_credits: maxC,
          is_active: body.is_active ?? true,
          notes: body.notes || null,
        };
        if (!payload.display_name || !payload.warez_username || !payload.warez_user_id || !payload.price_per_credit) {
          return ok({ error: "Campos obrigatórios faltando" }, 400);
        }
        const { data, error } = await supabase.from("reseller_links").insert(payload).select().single();
        if (error) {
          if (error.code === "23505" && error.message.includes("reseller_links_slug_key")) {
            return ok({ error: `Já existe um revendedor com o link "${payload.slug}". Use outro slug.` }, 400);
          }
          throw error;
        }
        return ok({ link: data });
      }

      case "update-link": {
        const id = String(body.id || "");
        if (!id) return ok({ error: "id obrigatório" }, 400);
        const patch: Record<string, unknown> = {};
        for (const k of ["slug", "display_name", "warez_username", "warez_user_id", "credits", "amount", "price_per_credit", "min_credits", "max_credits", "is_active", "notes"]) {
          if (k in body) patch[k] = body[k];
        }
        if (patch.slug) patch.slug = slugify(String(patch.slug));
        for (const k of ["warez_user_id", "credits", "amount", "price_per_credit", "min_credits", "max_credits"]) {
          if (k in patch) patch[k] = Number(patch[k]);
        }
        const { data, error } = await supabase.from("reseller_links").update(patch).eq("id", id).select().single();
        if (error) throw error;
        return ok({ link: data });
      }

      case "delete-link": {
        const id = String(body.id || "");
        if (!id) return ok({ error: "id obrigatório" }, 400);
        const { error } = await supabase.from("reseller_links").delete().eq("id", id);
        if (error) throw error;
        return ok({ success: true });
      }

      // -------- Purchases --------
      case "list-purchases": {
        const limit = Math.min(Number(url.searchParams.get("limit") || 200), 500);
        const status = url.searchParams.get("status");
        const since = url.searchParams.get("since");
        let q = supabase.from("reseller_credit_purchases").select("*").order("created_at", { ascending: false }).limit(limit);
        if (status) q = q.eq("status", status);
        if (since) q = q.gte("created_at", since);
        const { data, error } = await q;
        if (error) throw error;
        return ok({ purchases: data || [] });
      }

      case "reprocess-purchase": {
        const id = String(body.id || "");
        if (!id) return ok({ error: "id obrigatório" }, 400);
        const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/reseller-process-recharge`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ purchase_id: id }),
        });
        const data = await r.json().catch(() => ({}));
        return ok({ result: data }, r.ok ? 200 : 400);
      }

      case "mark-paid": {
        const id = String(body.id || "");
        if (!id) return ok({ error: "id obrigatório" }, 400);
        const { data: upd, error } = await supabase
          .from("reseller_credit_purchases")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", id)
          .eq("status", "pending")
          .select()
          .maybeSingle();
        if (error) throw error;
        if (!upd) return ok({ error: "Compra não está pendente" }, 400);
        // dispara recarga
        const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/reseller-process-recharge`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ purchase_id: id }),
        });
        const data = await r.json().catch(() => ({}));
        return ok({ success: true, recharge: data });
      }

      case "close-purchase": {
        const id = String(body.id || "");
        if (!id) return ok({ error: "id obrigatório" }, 400);
        const { error } = await supabase
          .from("reseller_credit_purchases")
          .update({ status: "cancelled" })
          .eq("id", id);
        if (error) throw error;
        return ok({ success: true });
      }

      case "delete-purchase": {
        const id = String(body.id || "");
        if (!id) return ok({ error: "id obrigatório" }, 400);
        const { error } = await supabase
          .from("reseller_credit_purchases")
          .delete()
          .eq("id", id);
        if (error) throw error;
        return ok({ success: true });
      }


      // -------- Config --------
      case "get-config": {
        const { data, error } = await supabase.from("system_config").select("*");
        if (error) throw error;
        const obj: Record<string, string> = {};
        (data || []).forEach((r: { config_key: string; config_value: string }) => {
          obj[r.config_key] = r.config_value;
        });
        return ok({ config: obj });
      }

      case "update-config": {
        const entries = body.entries as Record<string, string> | undefined;
        if (!entries || typeof entries !== "object") return ok({ error: "entries obrigatório" }, 400);
        const rows = Object.entries(entries).map(([config_key, config_value]) => ({
          config_key,
          config_value: String(config_value),
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from("system_config").upsert(rows);
        if (error) throw error;
        return ok({ success: true });
      }

      // -------- Dashboard --------
      case "dashboard": {
        const { data: purchases, error } = await supabase
          .from("reseller_credit_purchases")
          .select("id, warez_username, warez_user_id, package_credits, amount, status, recharge_status, recharged_at, created_at, reseller_link_id");
        if (error) throw error;

        const { data: cfg } = await supabase.from("system_config").select("config_value").eq("config_key", "credit_cost_brl").maybeSingle();
        const costPerCredit = Number(cfg?.config_value || 0);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const isRecharged = (p: { recharge_status: string }) => p.recharge_status === "recharged";

        const monthRecharged = (purchases || []).filter((p) => isRecharged(p) && p.recharged_at && p.recharged_at >= monthStart);
        const revenueMonth = monthRecharged.reduce((s, p) => s + Number(p.amount), 0);
        const costMonth = monthRecharged.reduce((s, p) => s + Number(p.package_credits) * costPerCredit, 0);
        const profitMonth = revenueMonth - costMonth;
        const margin = revenueMonth > 0 ? (profitMonth / revenueMonth) * 100 : 0;
        const ticket = monthRecharged.length > 0 ? revenueMonth / monthRecharged.length : 0;

        // Per reseller (all-time)
        const byReseller = new Map<string, { warez_username: string; count: number; credits: number; revenue: number; cost: number }>();
        (purchases || []).filter(isRecharged).forEach((p) => {
          const key = p.warez_username;
          const cur = byReseller.get(key) || { warez_username: key, count: 0, credits: 0, revenue: 0, cost: 0 };
          cur.count++;
          cur.credits += Number(p.package_credits);
          cur.revenue += Number(p.amount);
          cur.cost += Number(p.package_credits) * costPerCredit;
          byReseller.set(key, cur);
        });
        const perReseller = Array.from(byReseller.values())
          .map((r) => ({ ...r, profit: r.revenue - r.cost, margin: r.revenue > 0 ? ((r.revenue - r.cost) / r.revenue) * 100 : 0 }))
          .sort((a, b) => b.revenue - a.revenue);

        // Last 30 days series
        const series: { date: string; revenue: number; cost: number; profit: number }[] = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          const dateStr = d.toISOString().slice(0, 10);
          const dayRecharged = (purchases || []).filter(
            (p) => isRecharged(p) && p.recharged_at && p.recharged_at.slice(0, 10) === dateStr,
          );
          const rev = dayRecharged.reduce((s, p) => s + Number(p.amount), 0);
          const cst = dayRecharged.reduce((s, p) => s + Number(p.package_credits) * costPerCredit, 0);
          series.push({ date: dateStr, revenue: rev, cost: cst, profit: rev - cst });
        }

        return ok({
          kpis: {
            revenue_month: revenueMonth,
            cost_month: costMonth,
            profit_month: profitMonth,
            margin_pct: margin,
            count_month: monthRecharged.length,
            ticket_avg: ticket,
            cost_per_credit: costPerCredit,
          },
          per_reseller: perReseller,
          series_30d: series,
        });
      }

      // -------- Customers (payments) --------
      case "list-payments": {
        const limit = Math.min(Number(url.searchParams.get("limit") || 300), 500);
        const status = url.searchParams.get("status");
        let q = supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(limit);
        if (status) q = q.eq("fastdepix_status", status);
        const { data, error } = await q;
        if (error) throw error;
        return ok({ payments: data || [] });
      }

      case "delete-payment": {
        const id = String(body.id || "");
        if (!id) return ok({ error: "id obrigatório" }, 400);
        const { error } = await supabase.from("payments").delete().eq("id", id);
        if (error) throw error;
        return ok({ success: true });
      }

      case "customers-dashboard": {
        const { data: payments, error } = await supabase
          .from("payments")
          .select("id, customer_id, customer_name, plan_id, plan_name, amount, fastdepix_status, paid_at, created_at");
        if (error) throw error;

        const { data: cfg } = await supabase
          .from("system_config")
          .select("config_value")
          .eq("config_key", "customer_cost_pct")
          .maybeSingle();
        const costPct = Number(cfg?.config_value || 0);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const isPaid = (p: { fastdepix_status: string; paid_at: string | null }) =>
          (p.fastdepix_status === "paid" || p.fastdepix_status === "PAID" || !!p.paid_at);

        const allPaid = (payments || []).filter(isPaid);
        const monthPaid = allPaid.filter((p) => (p.paid_at || p.created_at) >= monthStart);

        const revenueMonth = monthPaid.reduce((s, p) => s + Number(p.amount), 0);
        const costMonth = revenueMonth * (costPct / 100);
        const profitMonth = revenueMonth - costMonth;
        const margin = revenueMonth > 0 ? (profitMonth / revenueMonth) * 100 : 0;
        const ticket = monthPaid.length > 0 ? revenueMonth / monthPaid.length : 0;

        // Por plano (acumulado)
        const byPlan = new Map<string, { plan_name: string; count: number; revenue: number }>();
        allPaid.forEach((p) => {
          const key = p.plan_name || `Plano ${p.plan_id}`;
          const cur = byPlan.get(key) || { plan_name: key, count: 0, revenue: 0 };
          cur.count++;
          cur.revenue += Number(p.amount);
          byPlan.set(key, cur);
        });
        const perPlan = Array.from(byPlan.values())
          .map((r) => ({ ...r, cost: r.revenue * (costPct / 100), profit: r.revenue * (1 - costPct / 100) }))
          .sort((a, b) => b.revenue - a.revenue);

        // Série 30d
        const series: { date: string; revenue: number; cost: number; profit: number }[] = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          const dateStr = d.toISOString().slice(0, 10);
          const dayPaid = allPaid.filter((p) => (p.paid_at || p.created_at).slice(0, 10) === dateStr);
          const rev = dayPaid.reduce((s, p) => s + Number(p.amount), 0);
          const cst = rev * (costPct / 100);
          series.push({ date: dateStr, revenue: rev, cost: cst, profit: rev - cst });
        }

        return ok({
          kpis: {
            revenue_month: revenueMonth,
            cost_month: costMonth,
            profit_month: profitMonth,
            margin_pct: margin,
            count_month: monthPaid.length,
            ticket_avg: ticket,
            cost_pct: costPct,
          },
          per_plan: perPlan,
          series_30d: series,
        });
      }
      
      case "list-otp-logs": {
        const { data, error } = await supabase
          .from("otp_codes")
          .select("id, phone, customer_id, created_at, consumed_at, ip_address, attempts")
          .order("created_at", { ascending: false })
          .limit(300);
        if (error) throw error;
        return ok({ logs: data || [] });
      }
      
      default:
        return ok({ error: "ação inválida" }, 400);
    }
  } catch (err) {
    const anyErr = err as { message?: string; details?: string; hint?: string; code?: string };
    const message =
      (anyErr && (anyErr.message || anyErr.details || anyErr.hint)) ||
      (typeof err === "string" ? err : JSON.stringify(err));
    console.error("[reseller-admin] error", message, anyErr?.code || "", anyErr?.details || "", anyErr?.hint || "");
    return ok({ error: message || "Erro desconhecido" }, 500);
  }
});
