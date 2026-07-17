// Fallback automático: varre reseller_credit_purchases com status='pending'
// consulta o SyncPay e, se estiver pago, marca como paid e dispara
// reseller-process-recharge. Rodar via pg_cron.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAID = ["paid", "approved", "completed", "success", "succeeded"];
const EXPIRED = ["expired", "cancelled", "canceled", "failed", "refunded"];

async function callProcessRecharge(purchaseId: string) {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/reseller-process-recharge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ purchase_id: purchaseId }),
    });
  } catch (e) {
    console.error("[poll] process-recharge invoke error", e);
  }
}

async function getSyncpayToken(base: string): Promise<string | null> {
  const clientId = Deno.env.get("SYNCPAY_CLIENT_ID");
  const clientSecret = Deno.env.get("SYNCPAY_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  try {
    const r = await fetch(`${base}/api/partner/v1/auth-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok && j.access_token ? j.access_token : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // pega base URL da Syncpay do system_config (mesmo padrão das outras funções)
  const { data: cfg } = await supabase
    .from("system_config")
    .select("config_value")
    .eq("config_key", "syncpay_api_url")
    .maybeSingle();
  const syncBase = ((cfg?.config_value as string) || "https://api.syncpayments.com.br").replace(/\/+$/, "");

  // varre pendentes das últimas 24h (evita reprocessar QRs muito antigos)
  const { data: pendings, error } = await supabase
    .from("reseller_credit_purchases")
    .select("id, provider, provider_transaction_id, status, recharge_status, created_at")
    .eq("status", "pending")
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[poll] select error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<Record<string, unknown>> = [];
  let syncToken: string | null = null;

  for (const p of pendings ?? []) {
    let liveStr = "";
    try {
      if (!p.provider_transaction_id) continue;
      if (!syncToken) syncToken = await getSyncpayToken(syncBase);
      if (!syncToken) continue;
      const r = await fetch(`${syncBase}/api/partner/v1/transaction/${p.provider_transaction_id}`, {
        headers: { Authorization: `Bearer ${syncToken}`, Accept: "application/json" },
      });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        liveStr = String((d?.data || d)?.status || "").toLowerCase();
      }
    } catch (e) {
      console.error("[poll] provider error", p.id, e);
      continue;
    }

    if (PAID.includes(liveStr)) {
      const { data: upd } = await supabase
        .from("reseller_credit_purchases")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", p.id)
        .eq("status", "pending")
        .select()
        .maybeSingle();
      if (upd) {
        await callProcessRecharge(p.id);
        results.push({ id: p.id, action: "paid+recharge" });
      }
    } else if (EXPIRED.includes(liveStr)) {
      await supabase.from("reseller_credit_purchases").update({ status: "expired" }).eq("id", p.id);
      results.push({ id: p.id, action: "expired" });
    }
  }

  return new Response(
    JSON.stringify({ scanned: pendings?.length ?? 0, updated: results.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
