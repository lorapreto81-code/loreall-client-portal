// SyncPay webhook handler — recebe eventos cashin.create / cashin.update
// e dispara a mesma lógica de "pagamento confirmado" usada pelo Fast Depix
// (renovação de cliente no TopGestor + indicações, ou recarga de revendedor WAREZ).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, event",
};

const TG_BASE = "https://topgestor.me/api/v1";
const BONUS_DAYS = 30;
const MIN_DAYS_REMAINING_TO_CREDIT = 4;
const REFERRAL_MESSAGE_ID = 58861;

// ---------- helpers de data ----------
function parseTGDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + "T00:00:00-03:00");
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function daysFromNow(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}
function addDays(date: Date, days: number): string {
  const d = new Date(date.getTime() + days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function tgGetCustomer(tgToken: string, customerId: number) {
  const res = await fetch(`${TG_BASE}/customers/${customerId}`, {
    headers: { Authorization: `Bearer ${tgToken}`, Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  return res.ok ? (data.data || data) : null;
}
async function tgAddBonusDays(tgToken: string, customerId: number, currentDueDate: Date, days: number, messageId?: number) {
  const newDate = addDays(currentDueDate, days);
  const body: Record<string, unknown> = { data_de_vencimento: newDate };
  if (messageId) { body.message_id = messageId; body.send_whatsapp = true; }
  const res = await fetch(`${TG_BASE}/customers/${customerId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${tgToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data, newDate };
}

async function processReferralOnPayment(
  supabase: ReturnType<typeof createClient>,
  tgToken: string,
  payment: Record<string, any>,
  refCode: string,
) {
  const { data: codeRow } = await supabase
    .from("referral_codes")
    .select("customer_id, customer_name")
    .eq("code", refCode)
    .maybeSingle();
  if (!codeRow) return;
  const referrerId = Number(codeRow.customer_id);
  const referredId = Number(payment.customer_id);
  if (referrerId === referredId) return;

  const { data: existing } = await supabase
    .from("referrals")
    .select("id, status")
    .eq("referrer_customer_id", referrerId)
    .eq("referred_customer_id", referredId)
    .maybeSingle();
  if (existing && existing.status === "credited") return;

  const referrer = await tgGetCustomer(tgToken, referrerId);
  if (!referrer) return;
  const dueDate = parseTGDate(referrer.data_de_vencimento);
  const daysLeft = dueDate ? daysFromNow(dueDate) : -999;
  const isActive = (String(referrer.status || "").toLowerCase() === "ativo") && daysLeft >= 0;

  let status = "pending_referrer_renewal";
  let creditedAt: string | null = null;
  let renewalResp: unknown = null;
  let rejection: string | null = null;

  if (isActive && daysLeft >= MIN_DAYS_REMAINING_TO_CREDIT && dueDate) {
    const r = await tgAddBonusDays(tgToken, referrerId, dueDate, BONUS_DAYS, REFERRAL_MESSAGE_ID);
    renewalResp = r.data;
    if (r.ok) { status = "credited"; creditedAt = new Date().toISOString(); }
    else rejection = `TG update failed: ${r.status}`;
  } else if (!isActive) rejection = `Indicador vencido/inativo (${daysLeft}d) - aguardar renovação`;
  else rejection = `Faltam ${daysLeft} dia(s) - aguardar renovação`;

  if (existing) {
    await supabase.from("referrals").update({
      status, credited_at: creditedAt, renewal_response: renewalResp, rejection_reason: rejection,
    }).eq("id", existing.id);
  } else {
    await supabase.from("referrals").insert({
      referrer_customer_id: referrerId,
      referred_customer_id: referredId,
      referred_customer_name: payment.customer_name,
      referred_payment_id: payment.id,
      referral_code: refCode,
      bonus_days: BONUS_DAYS,
      status, credited_at: creditedAt, renewal_response: renewalResp, rejection_reason: rejection,
    });
  }
}

async function releasePendingReferrals(
  supabase: ReturnType<typeof createClient>,
  tgToken: string,
  referrerId: number,
) {
  const { data: pending } = await supabase
    .from("referrals")
    .select("*")
    .eq("referrer_customer_id", referrerId)
    .eq("status", "pending_referrer_renewal");
  if (!pending || pending.length === 0) return;

  const referrer = await tgGetCustomer(tgToken, referrerId);
  if (!referrer) return;
  let dueDate = parseTGDate(referrer.data_de_vencimento);
  if (!dueDate) return;

  for (const ref of pending) {
    const r = await tgAddBonusDays(tgToken, referrerId, dueDate, ref.bonus_days || BONUS_DAYS, REFERRAL_MESSAGE_ID);
    if (r.ok) {
      dueDate = new Date(dueDate.getTime() + (ref.bonus_days || BONUS_DAYS) * 86400000);
      await supabase.from("referrals").update({
        status: "credited",
        credited_at: new Date().toISOString(),
        renewal_response: r.data,
        rejection_reason: null,
      }).eq("id", ref.id);
    }
  }
}

// ---------- helpers de assinatura ----------
async function findTgCustomerByCpfOrEmail(tgToken: string, cpf?: string, email?: string): Promise<number | null> {
  const q = (cpf || "").replace(/\D/g, "") || email || "";
  if (!q) return null;
  try {
    const res = await fetch(`${TG_BASE}/customers?search=${encodeURIComponent(q)}&per_page=5`, {
      headers: { Authorization: `Bearer ${tgToken}`, Accept: "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    const list = data.data || data.customers || [];
    return list[0]?.id ? Number(list[0].id) : null;
  } catch { return null; }
}

async function handleSubscriptionEvent(
  supabase: ReturnType<typeof createClient>,
  event: string,
  data: Record<string, any>,
) {
  const subId: string | undefined = data.subscription_id || data.subscription?.id || data.subscription?.token || data.id;
  const planId: string | undefined = data.plan_id || data.plan?.id || data.plan?.token || data.subscription?.plan_id;
  if (!subId) return { ok: true, ignored: "no subscription id" };

  const customer = data.customer || data.subscriber || {};
  const patch: Record<string, unknown> = {
    syncpay_subscription_id: subId,
    syncpay_plan_id: planId || "",
    customer_name: customer.name,
    customer_email: customer.email,
    customer_cpf: (customer.cpf || "").replace(/\D/g, ""),
    customer_phone: customer.phone || customer.whatsapp,
    billing_method: data.billing_method || data.subscription?.billing_method,
    metadata: data,
  };

  const { data: existing } = await supabase
    .from("syncpay_subscriptions")
    .select("*")
    .eq("syncpay_subscription_id", subId)
    .maybeSingle();

  let tgCustomerId: number | null = existing?.customer_id || null;
  if (!tgCustomerId) {
    const tgToken = Deno.env.get("TOPGESTOR_API_TOKEN");
    if (tgToken) tgCustomerId = await findTgCustomerByCpfOrEmail(tgToken, customer.cpf, customer.email);
  }
  if (tgCustomerId) patch.customer_id = tgCustomerId;

  const status = String(data.status || "").toLowerCase();
  if (event.includes("cancel") || status === "cancelled" || status === "canceled") {
    patch.status = "cancelled";
    patch.cancelled_at = new Date().toISOString();
  } else if (event.includes("suspend") || status === "suspended" || status === "delinquent") {
    patch.status = "suspended";
  } else if (event.includes("charge.paid") || event.includes("charge.succeeded")) {
    patch.status = "active";
    patch.last_charge_at = new Date().toISOString();
    if (data.next_charge_at || data.subscription?.next_charge_at) {
      patch.next_charge_at = data.next_charge_at || data.subscription.next_charge_at;
    }
  } else if (event.includes("create") || event.includes("activated")) {
    patch.status = "active";
  }

  await supabase.from("syncpay_subscriptions").upsert(patch, { onConflict: "syncpay_subscription_id" });

  const chargeId: string | undefined = data.charge_id || data.charge?.id || data.transaction_id;
  const isChargePaid = (event.includes("charge") && (event.includes("paid") || event.includes("succeeded")))
    || (event.includes("subscription") && status === "paid");

  if (isChargePaid && tgCustomerId) {
    const { data: planRow } = await supabase
      .from("syncpay_plans")
      .select("topgestor_plan_id, amount")
      .eq("syncpay_plan_id", planId || "")
      .maybeSingle();
    const tgPlanId = planRow?.topgestor_plan_id;
    const tgToken = Deno.env.get("TOPGESTOR_API_TOKEN");
    if (tgPlanId && tgToken) {
      try {
        const tgRes = await fetch(`${TG_BASE}/customers/${tgCustomerId}/renew`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tgToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ plan_id: tgPlanId, message_id: 44282, send_whatsapp: true }),
        });
        const rr = await tgRes.json().catch(() => ({}));
        await supabase.from("payments").insert({
          customer_id: tgCustomerId,
          customer_name: customer.name || `Sub ${subId}`,
          plan_id: tgPlanId,
          plan_name: `Assinatura ${planId}`,
          amount: Number(data.amount || planRow?.amount || 0),
          provider_transaction_id: chargeId || subId,
          subscription_id: subId,
          charge_id: chargeId || null,
          fastdepix_status: "paid",
          paid_at: new Date().toISOString(),
          renewal_response: rr,
          renewed_at: tgRes.ok ? new Date().toISOString() : null,
          metadata: { source: "syncpay_subscription" },
        });
      } catch (e) { console.error("[syncpay-webhook] sub renew failed", e); }
    } else {
      console.warn("[syncpay-webhook] charge paid sem mapeamento TG plan_id", { planId, tgCustomerId });
    }
  }

  return { ok: true, kind: "subscription", subscription_id: subId, status: patch.status };
}

// ---------- handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rawBody = await req.text();
  try {
    const payload = JSON.parse(rawBody || "{}");
    const event = String(req.headers.get("event") || payload.event || "").toLowerCase();
    const data = payload.data || payload;
    const txId: string | undefined = data.id || data.identifier || data.reference_id;
    const rawStatus = String(data.status || "").toLowerCase();
    const isPaid = ["completed", "paid", "approved", "success", "succeeded"].includes(rawStatus);
    const isExpired = ["failed", "expired", "cancelled", "canceled", "refunded"].includes(rawStatus);

    console.log("[syncpay-webhook] event", event, "tx", txId, "status", rawStatus);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Eventos de assinatura (recorrência) — rota separada
    if (event.includes("subscription") || event.includes("charge") || data.subscription_id || data.subscription) {
      const result = await handleSubscriptionEvent(supabase, event, data);
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!txId) {
      return new Response(JSON.stringify({ ok: true, ignored: "no transaction id" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenta achar em payments (cliente) ou reseller_credit_purchases (revendedor)
    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("provider_transaction_id", txId)
      .maybeSingle();

    if (!payment) {
      const { data: purchase } = await supabase
        .from("reseller_credit_purchases")
        .select("*")
        .eq("provider_transaction_id", txId)
        .maybeSingle();

      if (!purchase) {
        console.warn("[syncpay-webhook] transaction not found", txId);
        return new Response(JSON.stringify({ ok: true, ignored: "tx not found" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let next = purchase.status;
      if (isPaid) next = "paid";
      else if (isExpired) next = rawStatus === "refunded" ? "refunded" : "expired";

      if (next === "paid" && purchase.status !== "paid") {
        const { data: locked } = await supabase
          .from("reseller_credit_purchases")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", purchase.id)
          .eq("status", "pending")
          .select()
          .maybeSingle();
        if (locked) {
          try {
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/reseller-process-recharge`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({ purchase_id: purchase.id }),
            });
          } catch (e) { console.error("[syncpay-webhook] reseller invoke failed", e); }
        }
      } else if (next !== purchase.status) {
        await supabase.from("reseller_credit_purchases").update({ status: next }).eq("id", purchase.id);
      }
      return new Response(JSON.stringify({ ok: true, kind: "reseller", status: next }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente
    let newStatus = payment.fastdepix_status;
    if (isPaid) newStatus = "paid";
    else if (isExpired) newStatus = rawStatus === "refunded" ? "refunded" : "expired";

    const wasPaid = payment.fastdepix_status === "paid";
    const becomingPaid = newStatus === "paid" && !wasPaid;

    if (!becomingPaid) {
      if (newStatus !== payment.fastdepix_status) {
        await supabase.from("payments").update({ fastdepix_status: newStatus }).eq("id", payment.id);
      }
      return new Response(JSON.stringify({ ok: true, kind: "customer", status: newStatus }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // LOCK ATÔMICO: só um processo consegue mudar pending → paid.
    // Evita renovar 2-3x quando SyncPay reenvia webhook ou o polling do
    // cliente dispara essa mesma função em paralelo.
    const { data: locked } = await supabase
      .from("payments")
      .update({ fastdepix_status: "paid", paid_at: new Date().toISOString() })
      .eq("id", payment.id)
      .eq("fastdepix_status", "pending")
      .select()
      .maybeSingle();

    if (!locked) {
      console.log("[syncpay-webhook] already processed, skipping renew", payment.id);
      return new Response(JSON.stringify({ ok: true, kind: "customer", already_processed: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tgToken = Deno.env.get("TOPGESTOR_API_TOKEN");
    if (tgToken) {
      try {
        const tgRes = await fetch(`${TG_BASE}/customers/${payment.customer_id}/renew`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tgToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ plan_id: payment.plan_id, message_id: 44282, send_whatsapp: true }),
        });
        const rr = await tgRes.json().catch(() => ({}));
        const patch: Record<string, unknown> = { renewal_response: rr };
        if (tgRes.ok) patch.renewed_at = new Date().toISOString();
        else console.error("[syncpay-webhook] TG renew failed", tgRes.status, rr);
        await supabase.from("payments").update(patch).eq("id", payment.id);
      } catch (e) {
        console.error("[syncpay-webhook] TG renew exception", e);
      }

      const refCode: string | null = payment?.metadata?.referral_code || null;
      if (refCode) {
        try { await processReferralOnPayment(supabase, tgToken, payment, refCode); }
        catch (e) { console.error("[syncpay-webhook] referral failed", e); }
      }
      try { await releasePendingReferrals(supabase, tgToken, payment.customer_id); }
      catch (e) { console.error("[syncpay-webhook] release pending failed", e); }
    }


    return new Response(JSON.stringify({ ok: true, kind: "customer", status: newStatus }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[syncpay-webhook] error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
