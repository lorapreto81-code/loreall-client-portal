import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TG_BASE = "https://topgestor.me/api/v1";
const ADMIN_PASSWORD = "@996157342Slyj";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { admin_password, payment_id } = body as { admin_password?: string; payment_id?: string };

    if (admin_password !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!payment_id) {
      return new Response(JSON.stringify({ error: "payment_id required" }), {
        status: 400,
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
      .eq("id", payment_id)
      .maybeSingle();

    if (findErr || !payment) {
      return new Response(JSON.stringify({ error: "payment not found", details: findErr?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payment.fastdepix_status === "paid" && payment.renewed_at) {
      return new Response(JSON.stringify({ ok: true, already_processed: true, payment }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tgToken = Deno.env.get("TOPGESTOR_API_TOKEN");
    if (!tgToken) throw new Error("TOPGESTOR_API_TOKEN not configured");

    // 1) Renova no TopGestor
    const tgRes = await fetch(`${TG_BASE}/customers/${payment.customer_id}/renew`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tgToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ plan_id: payment.plan_id }),
    });
    const renewalResponse = await tgRes.json().catch(() => ({}));

    if (!tgRes.ok) {
      return new Response(
        JSON.stringify({ error: "TG renew failed", status: tgRes.status, details: renewalResponse }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nowIso = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("payments")
      .update({
        fastdepix_status: "paid",
        paid_at: payment.paid_at || nowIso,
        renewed_at: nowIso,
        renewal_response: renewalResponse,
      })
      .eq("id", payment.id);

    if (updErr) throw new Error(`DB update failed: ${updErr.message}`);

    return new Response(
      JSON.stringify({ ok: true, customer_id: payment.customer_id, renewal_response: renewalResponse }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const anyErr = err as { message?: string; details?: string };
    const message = anyErr?.message || anyErr?.details || JSON.stringify(err);
    console.error("[admin-mark-payment-paid] error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
