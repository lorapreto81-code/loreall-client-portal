import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

const TG_BASE = "https://topgestor.me/api/v1";

async function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): Promise<boolean> {
  if (!signatureHeader) return false;
  const expectedHex = await hmacSha256Hex(rawBody, secret);
  const expected = `sha256=${expectedHex}`;
  // Constant-time-ish comparison
  if (signatureHeader.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ----- Referral helpers -----

const BONUS_DAYS = 30;
const MIN_DAYS_REMAINING_TO_CREDIT = 4; // ≤3 dias = pendente

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
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function tgGetCustomer(tgToken: string, customerId: number) {
  const res = await fetch(`${TG_BASE}/customers/${customerId}`, {
    headers: { Authorization: `Bearer ${tgToken}`, Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  return res.ok ? (data.data || data) : null;
}

async function tgAddBonusDays(tgToken: string, customerId: number, currentDueDate: Date, days: number) {
  const newDate = addDays(currentDueDate, days);
  const res = await fetch(`${TG_BASE}/customers/${customerId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${tgToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ data_de_vencimento: newDate }),
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
  if (!codeRow) {
    console.warn("[referral] code not found", refCode);
    return;
  }
  const referrerId = Number(codeRow.customer_id);
  const referredId = Number(payment.customer_id);
  if (referrerId === referredId) {
    console.warn("[referral] self-referral blocked", referrerId);
    return;
  }

  const { data: existing } = await supabase
    .from("referrals")
    .select("id, status")
    .eq("referrer_customer_id", referrerId)
    .eq("referred_customer_id", referredId)
    .maybeSingle();
  if (existing && existing.status === "credited") return;

  const referrer = await tgGetCustomer(tgToken, referrerId);
  if (!referrer) {
    console.error("[referral] referrer not found in TG", referrerId);
    return;
  }
  const dueDate = parseTGDate(referrer.data_de_vencimento);
  const daysLeft = dueDate ? daysFromNow(dueDate) : -999;
  const isActive = (String(referrer.status || "").toLowerCase() === "ativo") && daysLeft >= 0;

  let status = "pending_referrer_renewal";
  let creditedAt: string | null = null;
  let renewalResp: unknown = null;
  let rejection: string | null = null;

  if (isActive && daysLeft >= MIN_DAYS_REMAINING_TO_CREDIT && dueDate) {
    const result = await tgAddBonusDays(tgToken, referrerId, dueDate, BONUS_DAYS);
    renewalResp = result.data;
    if (result.ok) {
      status = "credited";
      creditedAt = new Date().toISOString();
    } else {
      rejection = `TG update failed: ${result.status}`;
    }
  } else if (!isActive) {
    rejection = `Indicador vencido/inativo (${daysLeft}d) - aguardar renovação`;
  } else {
    rejection = `Faltam ${daysLeft} dia(s) - aguardar renovação`;
  }

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
  console.log("[referral] processed", { referrerId, referredId, status });
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
    const result = await tgAddBonusDays(tgToken, referrerId, dueDate, ref.bonus_days || BONUS_DAYS);
    if (result.ok) {
      dueDate = new Date(dueDate.getTime() + (ref.bonus_days || BONUS_DAYS) * 86400000);
      await supabase.from("referrals").update({
        status: "credited",
        credited_at: new Date().toISOString(),
        renewal_response: result.data,
        rejection_reason: null,
      }).eq("id", ref.id);
      console.log("[referral] released pending", ref.id);
    } else {
      console.error("[referral] failed to release", ref.id, result.status);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rawBody = await req.text();

  try {
    const secret = Deno.env.get("FASTDEPIX_WEBHOOK_SECRET");
    if (!secret) {
      console.error("[fastdepix-webhook] FASTDEPIX_WEBHOOK_SECRET not configured");
      return new Response("misconfigured", { status: 500, headers: corsHeaders });
    }

    const signature = req.headers.get("x-webhook-signature") || req.headers.get("X-Webhook-Signature");
    const valid = await verifySignature(rawBody, signature, secret);
    if (!valid) {
      console.warn("[fastdepix-webhook] invalid signature", { signature });
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const payload = JSON.parse(rawBody);
    console.log("[fastdepix-webhook] received", payload?.event, payload?.transaction_id);

    const event: string = payload.event || "";
    const txId: number | undefined = payload.transaction_id ?? payload.data?.id;

    if (!txId) {
      return new Response(JSON.stringify({ ok: true, ignored: "no transaction_id" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: payment, error: findErr } = await supabase
      .from("payments")
      .select("*")
      .eq("fastdepix_transaction_id", txId)
      .maybeSingle();

    if (findErr) {
      console.error("[fastdepix-webhook] DB find error", findErr);
      return new Response(JSON.stringify({ error: findErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!payment) {
      // Try reseller purchase flow
      const { data: purchase } = await supabase
        .from("reseller_credit_purchases")
        .select("*")
        .eq("fastdepix_transaction_id", txId)
        .maybeSingle();

      if (!purchase) {
        console.warn("[fastdepix-webhook] payment not found for tx", txId);
        return new Response(JSON.stringify({ ok: true, ignored: "payment not found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let resellerNewStatus = purchase.status;
      if (event === "transaction.paid" || event === "transaction.approved") resellerNewStatus = "paid";
      else if (event === "transaction.expired") resellerNewStatus = "expired";
      else if (event === "transaction.cancelled") resellerNewStatus = "cancelled";

      if (resellerNewStatus === "paid" && purchase.status !== "paid") {
        const { data: locked } = await supabase
          .from("reseller_credit_purchases")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", purchase.id)
          .eq("status", "pending")
          .select()
          .maybeSingle();

        if (locked) {
          // Dispara recarga WAREZ
          try {
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/reseller-process-recharge`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({ purchase_id: purchase.id }),
            });
          } catch (e) {
            console.error("[fastdepix-webhook] reseller process-recharge invoke failed", e);
          }
        }
      } else if (resellerNewStatus !== purchase.status) {
        await supabase
          .from("reseller_credit_purchases")
          .update({ status: resellerNewStatus })
          .eq("id", purchase.id);
      }

      return new Response(JSON.stringify({ ok: true, kind: "reseller", status: resellerNewStatus }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map event → status
    let newStatus = payment.fastdepix_status;
    if (event === "transaction.paid" || event === "transaction.approved") newStatus = "paid";
    else if (event === "transaction.expired") newStatus = "expired";
    else if (event === "transaction.cancelled") newStatus = "cancelled";

    // Idempotência: já está pago, não reprocessa renovação
    const wasPaid = payment.fastdepix_status === "paid";
    const becomingPaid = newStatus === "paid" && !wasPaid;

    const updates: Record<string, unknown> = { fastdepix_status: newStatus };
    if (becomingPaid) updates.paid_at = new Date().toISOString();

    let renewalResponse: unknown = null;

    if (becomingPaid) {
      const tgToken = Deno.env.get("TOPGESTOR_API_TOKEN");
      if (!tgToken) {
        console.error("[fastdepix-webhook] TOPGESTOR_API_TOKEN not configured");
      } else {
        // 1) Renova o indicado (cliente que pagou)
        try {
          const tgRes = await fetch(`${TG_BASE}/customers/${payment.customer_id}/renew`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tgToken}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ plan_id: payment.plan_id, invoice_status: "paid" }),
          });
          renewalResponse = await tgRes.json().catch(() => ({}));
          if (tgRes.ok) {
            updates.renewed_at = new Date().toISOString();
            console.log("[fastdepix-webhook] customer renewed", payment.customer_id);
          } else {
            console.error("[fastdepix-webhook] TG renew failed", tgRes.status, renewalResponse);
          }
        } catch (e) {
          console.error("[fastdepix-webhook] TG renew exception", e);
          renewalResponse = { error: e instanceof Error ? e.message : "unknown" };
        }
        updates.renewal_response = renewalResponse;

        // 2) Processa indicação (se este pagamento veio com referral_code)
        const refCode: string | null = payment?.metadata?.referral_code || null;
        if (refCode) {
          try {
            await processReferralOnPayment(supabase, tgToken, payment, refCode);
          } catch (e) {
            console.error("[fastdepix-webhook] referral processing failed", e);
          }
        }

        // 3) Libera indicações pendentes do tipo "pending_referrer_renewal"
        // onde ESTE customer (que acabou de pagar/renovar) é o INDICADOR
        try {
          await releasePendingReferrals(supabase, tgToken, payment.customer_id);
        } catch (e) {
          console.error("[fastdepix-webhook] release pending failed", e);
        }
      }
    }

    const { error: updErr } = await supabase
      .from("payments")
      .update(updates)
      .eq("id", payment.id);

    if (updErr) {
      console.error("[fastdepix-webhook] DB update error", updErr);
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, status: newStatus }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[fastdepix-webhook] error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
