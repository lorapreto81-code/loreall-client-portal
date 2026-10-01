// Discount codes: admin CRUD + public validation (preview only; create-pix re-validates).
import { createClient } from "npm:@supabase/supabase-js@2";
import { isAdminRequest } from "../_shared/auth.ts";
import { jsonResponse as json, securityHeadersFor, checkRateLimit } from "../_shared/security.ts";
import { evaluateDiscount, normalizeCode, CODE_RE } from "../_shared/discount.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: securityHeadersFor(req) });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const action = new URL(req.url).searchParams.get("action") || "";
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    if (action === "validate") {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
      if (!(await checkRateLimit(supabase, ip, "discount-validate", 20, 15))) {
        return json({ error: "Muitas tentativas. Aguarde alguns minutos." }, 429, {}, req);
      }
      const customerId = Number(body.customer_id);
      const amount = Number(body.amount);
      if (!Number.isInteger(customerId) || customerId <= 0 || !(amount > 0) || amount > 10000) {
        return json({ error: "Dados inválidos." }, 400, {}, req);
      }
      const r = await evaluateDiscount(supabase, body.code, customerId, amount);
      if (!r.ok) return json({ error: r.error }, 422, {}, req);
      return json({
        code: r.code.code, discount_type: r.code.discount_type, discount_value: Number(r.code.discount_value),
        discount: r.discount, final: r.final,
      }, 200, {}, req);
    }

    if (action === "first-renewal") {
      const session = await getCustomerSession(req);
      if (!isCustomerSession(session)) return json({ eligible: false, percent: 0 }, 200, {}, req);
      const r = await isFirstRenewalEligible(supabase, Number(session!.sub));
      return json(r, 200, {}, req);
    }

    if (!isAdminRequest(req)) return json({ error: "unauthorized" }, 401, {}, req);

    if (action === "get-first-renewal") {
      const cfg = await getFirstRenewalConfig(supabase);
      const { count } = await supabase.from("payments").select("id", { count: "exact", head: true })
        .eq("fastdepix_status", "paid").contains("metadata", { first_renewal: true });
      return json({ ...cfg, uses: count || 0 }, 200, {}, req);
    }
    if (action === "set-first-renewal") {
      const percent = Number(body.percent);
      if (!Number.isInteger(percent) || percent < 1 || percent > 90) return json({ error: "Porcentagem inválida." }, 400, {}, req);
      const now = new Date().toISOString();
      await supabase.from("system_config").upsert([
        { config_key: "first_renewal_discount_enabled", config_value: body.enabled ? "true" : "false", updated_at: now },
        { config_key: "first_renewal_discount_percent", config_value: String(percent), updated_at: now },
      ], { onConflict: "config_key" });
      return json({ ok: true }, 200, {}, req);
    }

    if (action === "list") {
      const { data: codes } = await supabase.from("discount_codes").select("*").order("created_at", { ascending: false });
      const { data: reds } = await supabase.from("discount_redemptions")
        .select("discount_code_id, discount_amount, payments!inner(fastdepix_status)").eq("payments.fastdepix_status", "paid");
      const stats: Record<string, { uses: number; total: number }> = {};
      for (const r of (reds || []) as { discount_code_id: string; discount_amount: number }[]) {
        const s = (stats[r.discount_code_id] ||= { uses: 0, total: 0 });
        s.uses++; s.total += Number(r.discount_amount) || 0;
      }
      return json({ codes: (codes || []).map((c) => ({ ...c, uses: stats[c.id]?.uses || 0, total_discount: stats[c.id]?.total || 0 })) }, 200, {}, req);
    }

    const parseFields = () => {
      const type = body.discount_type === "fixed" ? "fixed" : "percent";
      const value = Number(body.discount_value);
      if (!(value > 0) || (type === "percent" && value > 90) || (type === "fixed" && value > 500)) throw new Error("Valor do desconto inválido.");
      const maxUses = body.max_uses === null || body.max_uses === "" || body.max_uses === undefined ? null : Number(body.max_uses);
      if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) throw new Error("Limite de usos inválido.");
      const validUntil = body.valid_until ? new Date(String(body.valid_until)) : null;
      if (validUntil && isNaN(validUntil.getTime())) throw new Error("Validade inválida.");
      return {
        discount_type: type, discount_value: value, max_uses: maxUses,
        valid_until: validUntil ? validUntil.toISOString() : null,
        one_per_customer: body.one_per_customer !== false,
        is_active: body.is_active !== false,
        notes: body.notes ? String(body.notes).slice(0, 200) : null,
      };
    };

    if (action === "create") {
      const code = normalizeCode(body.code);
      if (!CODE_RE.test(code)) return json({ error: "Código deve ter 3–30 letras/números." }, 400, {}, req);
      const { data, error } = await supabase.from("discount_codes").insert({ code, ...parseFields() }).select().single();
      if (error) return json({ error: error.code === "23505" ? "Esse código já existe." : error.message }, 400, {}, req);
      return json({ code: data }, 200, {}, req);
    }
    if (action === "update") {
      const { error } = await supabase.from("discount_codes").update(parseFields()).eq("id", String(body.id));
      if (error) return json({ error: error.message }, 400, {}, req);
      return json({ ok: true }, 200, {}, req);
    }
    if (action === "toggle") {
      await supabase.from("discount_codes").update({ is_active: !!body.is_active }).eq("id", String(body.id));
      return json({ ok: true }, 200, {}, req);
    }
    if (action === "delete") {
      await supabase.from("discount_codes").delete().eq("id", String(body.id));
      return json({ ok: true }, 200, {}, req);
    }
    return json({ error: "Invalid action" }, 400, {}, req);
  } catch (e) {
    console.error("[discount-codes]", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 400, {}, req);
  }
});
