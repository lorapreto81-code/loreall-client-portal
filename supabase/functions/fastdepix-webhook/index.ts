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
      console.warn("[fastdepix-webhook] payment not found for tx", txId);
      return new Response(JSON.stringify({ ok: true, ignored: "payment not found" }), {
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
      // Renova no TopGestor com o plano selecionado
      const tgToken = Deno.env.get("TOPGESTOR_API_TOKEN");
      if (!tgToken) {
        console.error("[fastdepix-webhook] TOPGESTOR_API_TOKEN not configured");
      } else {
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
