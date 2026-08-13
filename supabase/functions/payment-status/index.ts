import { createClient } from "npm:@supabase/supabase-js@2";
import { getCustomerSession } from "../_shared/auth.ts";
import { signWebhookPayload, corsHeadersFor } from "../_shared/security.ts";

const corsHeaders = corsHeadersFor();



interface Body {
  action: "pending" | "status" | "history";
  customer_id?: number;
  payment_id?: string;
  limit?: number;
}

// Consulta ao vivo o status na SyncPay e, se o PIX já foi pago, dispara o
// syncpay-webhook para reaproveitar TODA a lógica de renovação no TopGestor
// + indicações.
async function pollAndSyncIfPaid(
  supabase: ReturnType<typeof createClient>,
  payment: Record<string, any>,
): Promise<string> {
  if (payment.fastdepix_status !== "pending") return payment.fastdepix_status;

  const paidStates = ["paid", "approved", "completed", "success", "succeeded"];
  const expiredStates = ["expired", "cancelled", "canceled", "failed", "refunded"];
  let liveStr = "";

  try {
    if (payment.provider_transaction_id) {
      const clientId = Deno.env.get("SYNCPAY_CLIENT_ID");
      const clientSecret = Deno.env.get("SYNCPAY_CLIENT_SECRET");
      if (clientId && clientSecret) {
        const { data: cfg } = await supabase
          .from("system_config")
          .select("config_value")
          .eq("config_key", "syncpay_api_url")
          .maybeSingle();
        const base = ((cfg?.config_value as string) || "https://api.syncpayments.com.br").replace(/\/+$/, "");
        const tokRes = await fetch(`${base}/api/partner/v1/auth-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
        });
        const tok = await tokRes.json().catch(() => ({}));
        if (tokRes.ok && tok.access_token) {
          const r = await fetch(
            `${base}/api/partner/v1/transaction/${payment.provider_transaction_id}`,
            { headers: { Authorization: `Bearer ${tok.access_token}`, Accept: "application/json" } },
          );
          if (r.ok) {
            const data = await r.json().catch(() => ({}));
            liveStr = String((data?.data || data)?.status || "").toLowerCase();
          }
        }
      }
    }
  } catch (e) {
    console.error("[payment-status] poll error", e);
    return payment.fastdepix_status;
  }

  if (paidStates.includes(liveStr)) {
    // Dispara o webhook do SyncPay com o txId — a função já cuida de marcar
    // como pago e renovar no TopGestor (mesma lógica do FastDepix).
    const txId = payment.provider_transaction_id;
    try {
      const webhookBody = JSON.stringify({ event: "cashin.update", data: { id: txId, status: "paid" } });
      const webhookSecret = Deno.env.get("SYNCPAY_WEBHOOK_SECRET") || "";
      const webhookSignature = webhookSecret ? await signWebhookPayload(webhookSecret, webhookBody) : "";
      
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/syncpay-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "x-syncpay-signature": webhookSignature,
        },
        body: webhookBody,
      });
    } catch (e) {
      console.error("[payment-status] webhook invoke failed", e);
    }
    return "paid";
  }

  if (expiredStates.includes(liveStr)) {
    const next = liveStr === "refunded" ? "refunded" : "expired";
    await supabase.from("payments").update({ fastdepix_status: next }).eq("id", payment.id);
    return next;
  }

  return payment.fastdepix_status;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const session = await getCustomerSession(req);
    if (!session) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (body.customer_id !== undefined && Number(body.customer_id) !== session.sub) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    body.customer_id = session.sub;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (body.action === "pending") {
      const customerId = Number(body.customer_id);
      if (!customerId) {
        return new Response(JSON.stringify({ error: "customer_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, qr_code_url, qr_code_text, qr_code_expires_at, fastdepix_status")
        .eq("customer_id", customerId)
        .eq("fastdepix_status", "pending")
        .gt("qr_code_expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({ payment: data || null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "history") {
      const customerId = Number(body.customer_id);
      if (!customerId) {
        return new Response(JSON.stringify({ error: "customer_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 100);
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, plan_name, provider, fastdepix_status, paid_at, created_at, renewed_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return new Response(JSON.stringify({ payments: data || [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "status") {
      const paymentId = String(body.payment_id || "");
      const customerId = Number(body.customer_id);
      if (!paymentId || !customerId) {
        return new Response(JSON.stringify({ error: "payment_id and customer_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .eq("customer_id", customerId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Polling ao vivo na adquirente (mesma lógica do reseller-check-status).
      // Se já foi pago, dispara o webhook que renova no TopGestor.
      await pollAndSyncIfPaid(supabase, data);

      // Re-busca o status atualizado após eventual webhook
      const { data: fresh } = await supabase
        .from("payments")
        .select("id, fastdepix_status, paid_at")
        .eq("id", paymentId)
        .maybeSingle();

      return new Response(JSON.stringify(fresh || { id: data.id, fastdepix_status: data.fastdepix_status, paid_at: data.paid_at }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[payment-status] error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
