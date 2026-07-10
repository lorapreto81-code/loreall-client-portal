// Admin CRUD wrapper para SyncPay Assinaturas (Recorrência).
// Base: https://api.syncpayments.com.br/api/partner/v1
//
// Actions:
//   list-plans, create-plan, update-plan, archive-plan
//   list-subscribers, cancel-subscription
//   sync-plans   (busca no SyncPay e espelha no banco local)

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password",
};

const ADMIN_PASSWORD = "@996157342Slyj";
const SP_BASE = "https://api.syncpayments.com.br/api/partner/v1";

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------- Token cache ----------
let tokenCache: { token: string; exp: number } | null = null;

async function getSyncpayToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.token;
  const clientId = Deno.env.get("SYNCPAY_CLIENT_ID");
  const clientSecret = Deno.env.get("SYNCPAY_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("SYNCPAY_CLIENT_ID/SECRET não configurados");

  // Endpoint oficial: POST /api/partner/v1/token  (client_credentials)
  const res = await fetch(`${SP_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`SyncPay auth ${res.status}: ${JSON.stringify(data)}`);
  const token = data.access_token || data.token || data.data?.access_token || data.data?.token;
  const expiresIn = Number(data.expires_in || data.data?.expires_in || 3600);
  if (!token) throw new Error("SyncPay: token ausente na resposta");
  tokenCache = { token, exp: Date.now() + (expiresIn - 60) * 1000 };
  return token;
}

async function spFetch(path: string, method: string, body?: unknown) {
  const token = await getSyncpayToken();
  const res = await fetch(`${SP_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const pwd = req.headers.get("x-admin-password");
    if (pwd !== ADMIN_PASSWORD) return err("Unauthorized", 401);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    switch (action) {
      case "list-plans": {
        const { data: rows } = await supabase
          .from("syncpay_plans")
          .select("*")
          .order("created_at", { ascending: false });
        return ok({ plans: rows || [] });
      }

      case "sync-plans": {
        const r = await spFetch("/subscription-plans?per_page=100", "GET");
        if (!r.ok) return err(`SyncPay: ${r.status}`, r.status);
        const list = r.data.data || r.data.plans || [];
        for (const p of list) {
          await supabase.from("syncpay_plans").upsert({
            syncpay_plan_id: String(p.token || p.id),
            name: p.name,
            description: p.description || null,
            amount: Number(p.amount || 0),
            periodicity_days: Number(p.periodicity_days || 30),
            billing_advance_days: Number(p.billing_advance_days || 3),
            grace_period_days: Number(p.grace_period_days || 5),
            max_retry_attempts: Number(p.max_retry_attempts || 3),
            billing_method: p.billing_method || "qr_code",
            status: p.status || "active",
            checkout_url: p.checkout_url || null,
            metadata: p,
          }, { onConflict: "syncpay_plan_id" });
        }
        return ok({ synced: list.length });
      }

      case "create-plan": {
        const payload = {
          name: body.name,
          description: body.description || "",
          amount: Number(body.amount),
          periodicity_days: Number(body.periodicity_days || 30),
          billing_advance_days: Number(body.billing_advance_days || 3),
          grace_period_days: Number(body.grace_period_days || 5),
          max_retry_attempts: Number(body.max_retry_attempts || 3),
          billing_method: body.billing_method || "qr_code",
        };
        const r = await spFetch("/subscription-plans", "POST", payload);
        if (!r.ok) return err(`SyncPay: ${JSON.stringify(r.data)}`, r.status);
        const p = r.data.data || r.data;
        const { data: saved } = await supabase.from("syncpay_plans").insert({
          syncpay_plan_id: String(p.token || p.id),
          name: p.name,
          description: p.description || null,
          amount: Number(p.amount || payload.amount),
          periodicity_days: payload.periodicity_days,
          billing_advance_days: payload.billing_advance_days,
          grace_period_days: payload.grace_period_days,
          max_retry_attempts: payload.max_retry_attempts,
          billing_method: p.billing_method || payload.billing_method,
          status: p.status || "active",
          checkout_url: p.checkout_url || null,
          topgestor_plan_id: body.topgestor_plan_id ? Number(body.topgestor_plan_id) : null,
          metadata: p,
        }).select().maybeSingle();
        return ok({ plan: saved });
      }

      case "update-plan": {
        // Atualiza mapeamento local (plano TG) e opcionalmente edita no SyncPay
        const { id, topgestor_plan_id, name, description, amount } = body;
        if (!id) return err("id required");
        if (name || description || amount) {
          const row = await supabase.from("syncpay_plans").select("*").eq("id", id).maybeSingle();
          const spId = row.data?.syncpay_plan_id;
          if (spId) {
            const r = await spFetch(`/subscription-plans/${spId}`, "PATCH", {
              ...(name && { name }),
              ...(description !== undefined && { description }),
              ...(amount && { amount: Number(amount) }),
            });
            if (!r.ok) return err(`SyncPay: ${JSON.stringify(r.data)}`, r.status);
          }
        }
        const patch: Record<string, unknown> = {};
        if (topgestor_plan_id !== undefined) patch.topgestor_plan_id = topgestor_plan_id ? Number(topgestor_plan_id) : null;
        if (name) patch.name = name;
        if (description !== undefined) patch.description = description;
        if (amount) patch.amount = Number(amount);
        await supabase.from("syncpay_plans").update(patch).eq("id", id);
        return ok({ success: true });
      }

      case "archive-plan": {
        const { id } = body;
        const row = await supabase.from("syncpay_plans").select("syncpay_plan_id").eq("id", id).maybeSingle();
        if (row.data?.syncpay_plan_id) {
          await spFetch(`/subscription-plans/${row.data.syncpay_plan_id}`, "DELETE");
        }
        await supabase.from("syncpay_plans").update({ status: "archived" }).eq("id", id);
        return ok({ success: true });
      }

      case "list-subscribers": {
        const spId = url.searchParams.get("plan_id");
        if (!spId) return err("plan_id required");
        const r = await spFetch(`/subscription-plans/${spId}/subscribers?per_page=100`, "GET");
        if (!r.ok) return err(`SyncPay: ${r.status}`, r.status);
        const { data: local } = await supabase
          .from("syncpay_subscriptions")
          .select("*")
          .eq("syncpay_plan_id", spId);
        return ok({ subscribers: r.data.data || r.data.subscribers || [], local: local || [] });
      }

      case "cancel-subscription": {
        const { subscription_id } = body;
        if (!subscription_id) return err("subscription_id required");
        const r = await spFetch(`/subscriptions/${subscription_id}`, "DELETE");
        if (!r.ok) return err(`SyncPay: ${r.status}`, r.status);
        await supabase.from("syncpay_subscriptions")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("syncpay_subscription_id", subscription_id);
        return ok({ success: true });
      }

      default:
        return err(`Unknown action: ${action}`, 404);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[syncpay-subscriptions]", message);
    return err(message, 500);
  }
});
