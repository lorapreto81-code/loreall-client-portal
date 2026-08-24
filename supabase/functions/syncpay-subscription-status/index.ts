import { createClient } from "npm:@supabase/supabase-js@2";
import { securityHeadersFor, jsonResponse as json } from "../_shared/security.ts";
import { getCustomerSession, isAdminRequest, isCustomerSession } from "../_shared/auth.ts";


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
    const session = await getCustomerSession(req);
    const { subscription_id, customer_id } = await req.json().catch(() => ({}));


    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validação de acesso: ou é admin ou é o próprio cliente dono da assinatura
    const isAdmin = isAdminRequest(req);
    const isCustomer = isCustomerSession(session);
    if (!isAdmin && !isCustomer) {
      return json({ error: "Unauthorized" }, 401, {}, req);
    }


    let subId = subscription_id;
    let planIdHint: string | null = null;

    if (!subId && customer_id) {
      // Se for cliente, só pode consultar o seu próprio ID
      if (isCustomer && Number(session.sub) !== Number(customer_id)) {
        return json({ error: "Forbidden" }, 403, {}, req);
      }

      const { data: latest } = await supabase
        .from("syncpay_subscriptions")
        .select("syncpay_subscription_id, syncpay_plan_id")
        .eq("customer_id", customer_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      subId = latest?.syncpay_subscription_id;
      planIdHint = latest?.syncpay_plan_id || null;
    }

    if (!subId) {
      return json({ 
        subscription_id: null, 
        status: "none", 
        message: "Nenhuma assinatura encontrada para este identificador" 
      }, 200, {}, req);
    }

    // Se passou apenas subId, valida se o cliente é dono dessa sub específica
    if (isCustomer && !customer_id) {
      const { data: subCheck } = await supabase
        .from("syncpay_subscriptions")
        .select("customer_id")
        .eq("syncpay_subscription_id", subId)
        .maybeSingle();
      if (!subCheck || Number(subCheck.customer_id) !== Number(session.sub)) {
        return json({ error: "Forbidden" }, 403, {}, req);
      }
    }


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
    const nextChargeAt = sub.next_charge_at || sub.next_billing_date || sub.next_due_date || sub.next_cycle_date || null;

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
      next_charge_at: nextChargeAt,
      metadata: sub,
    }).eq("syncpay_subscription_id", subId);

    let amount: number | null = null;
    const planId = sub.plan_token || sub.plan_id || planIdHint;
    if (planId) {
      const { data: planRow } = await supabase
        .from("syncpay_plans")
        .select("amount")
        .eq("syncpay_plan_id", planId)
        .maybeSingle();
      amount = planRow?.amount ?? null;
    }

    return json({
      subscription_id: subId,
      status,
      mandate_status: mandateStatus,
      next_charge_at: nextChargeAt,
      amount,
      raw: sub
    }, 200, {}, req);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[syncpay-subscription-status]", message);
    return json({ error: message }, 500, {}, req);
  }
});
