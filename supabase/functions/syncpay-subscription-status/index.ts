import { createClient } from "npm:@supabase/supabase-js@2";
import { securityHeadersFor, jsonResponse as json } from "../_shared/security.ts";

const SP_BASE = "https://api.syncpayments.com.br/api/partner/v1";

let tokenCache: { token: string; exp: number } | null = null;
async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.token;
  const clientId = Deno.env.get("SYNCPAY_CLIENT_ID");
  const clientSecret = Deno.env.get("SYNCPAY_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("SYNCPAY credentials missing");
  const res = await fetch(`${SP_BASE}/auth-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`SyncPay auth ${res.status}: ${JSON.stringify(data)}`);
  const token = data.access_token || data.token || data.data?.access_token || data.data?.token;
  if (!token) throw new Error("SyncPay auth response without access token");
  const expiresIn = Number(data.expires_in || data.data?.expires_in || 3600);
  tokenCache = { token, exp: Date.now() + (expiresIn - 60) * 1000 };
  return token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: securityHeadersFor(req) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, {}, req);

  try {
    const { subscription_id, customer_id } = await req.json().catch(() => ({}));
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let subId = subscription_id;

    // Se não veio subscription_id mas veio customer_id, busca a última assinatura deste cliente
    if (!subId && customer_id) {
      const { data: latest } = await supabase
        .from("syncpay_subscriptions")
        .select("syncpay_subscription_id")
        .eq("customer_id", customer_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      subId = latest?.syncpay_subscription_id;
    }

    if (!subId) return json({ error: "subscription_id ou customer_id não encontrado" }, 400, {}, req);

    const token = await getToken();
    const res = await fetch(`${SP_BASE}/subscriptions/${encodeURIComponent(subId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json({ error: "Falha ao consultar SyncPay", details: data }, res.status, {}, req);
    }

    const sub = data.data || data.subscription || data;
    const status = sub.status;
    const payment = sub.payment || sub.charge || sub.first_charge || {};
    const mandateStatus = payment.mandate_status || sub.mandate_status || sub.first_charge?.mandate_status;

    const accessStatus =
      status === "cancelled" ? "cancelled" :
      status === "suspended" ? "suspended" :
      status === "overdue" ? "grace_period" :
      status === "active" ? "active" :
      mandateStatus?.toUpperCase() === "ACTIVE" ? "pending_first_charge" :
      "pending";

    await supabase.from("syncpay_subscriptions").update({
      status: status,
      syncpay_status: status,
      access_status: accessStatus,
      mandate_id: payment.mandate_id || sub.mandate_id || null,
      mandate_status: mandateStatus || null,
      metadata: sub,
    }).eq("syncpay_subscription_id", subId);

    return json({
      status,
      mandate_status: mandateStatus,
      raw: sub
    }, 200, {}, req);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[syncpay-subscription-status]", message);
    return json({ error: message }, 500, {}, req);
  }
});