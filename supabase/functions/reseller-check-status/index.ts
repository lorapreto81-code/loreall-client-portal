import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FAST_BASE = "https://fastdepix.space/api/v1";

async function callProcessRecharge(purchaseId: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/reseller-process-recharge`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ purchase_id: purchaseId }),
    });
  } catch (e) {
    console.error("[reseller-check-status] invoke process-recharge failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id") || "";
    if (!id) {
      return new Response(JSON.stringify({ error: "id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: p, error } = await supabase
      .from("reseller_credit_purchases")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!p) {
      return new Response(JSON.stringify({ error: "Compra não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let underReview = false;
    let liveStatus = p.status;
    const provider: string = String(p.provider || "fastdepix");

    // Polling ao vivo conforme o provedor
    if (p.status === "pending") {
      const paidStates = ["paid", "approved", "completed", "success", "succeeded"];
      const expiredStates = ["expired", "cancelled", "canceled", "failed", "refunded"];
      const reviewStates = ["under_review", "processing", "in_review", "analyzing", "analysis", "pending"];
      let liveStr = "";

      try {
        if (provider === "syncpay" && p.provider_transaction_id) {
          const clientId = Deno.env.get("SYNCPAY_CLIENT_ID");
          const clientSecret = Deno.env.get("SYNCPAY_CLIENT_SECRET");
          if (clientId && clientSecret) {
            const { data: cfg } = await supabase.from("system_config").select("config_value").eq("config_key", "syncpay_api_url").maybeSingle();
            const base = ((cfg?.config_value as string) || "https://api.syncpayments.com.br").replace(/\/+$/, "");
            const tokRes = await fetch(`${base}/api/partner/v1/auth-token`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
            });
            const tok = await tokRes.json().catch(() => ({}));
            if (tokRes.ok && tok.access_token) {
              const r = await fetch(`${base}/api/partner/v1/transaction/${p.provider_transaction_id}`, {
                headers: { Authorization: `Bearer ${tok.access_token}`, Accept: "application/json" },
              });
              if (r.ok) {
                const data = await r.json().catch(() => ({}));
                liveStr = String((data?.data || data)?.status || "").toLowerCase();
              }
            }
          }
        } else if (p.fastdepix_transaction_id) {
          const apiKey = Deno.env.get("FASTDEPIX_RESELLER_API_KEY") || Deno.env.get("FASTDEPIX_API_KEY");
          if (apiKey) {
            const r = await fetch(`${FAST_BASE}/transactions/${p.fastdepix_transaction_id}`, {
              headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
            });
            if (r.ok) {
              const data = await r.json().catch(() => ({}));
              liveStr = String((data?.data || data)?.status || "").toLowerCase();
            }
          }
        }
      } catch (e) {
        console.error("[reseller-check-status] poll error", e);
      }

      if (paidStates.includes(liveStr)) {
        const { data: upd } = await supabase
          .from("reseller_credit_purchases")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", p.id).eq("status", "pending")
          .select().maybeSingle();
        if (upd) { liveStatus = "paid"; await callProcessRecharge(p.id); }
      } else if (expiredStates.includes(liveStr) && liveStr !== "pending") {
        await supabase.from("reseller_credit_purchases").update({ status: "expired" }).eq("id", p.id);
        liveStatus = "expired";
      } else if (reviewStates.includes(liveStr) && liveStr !== "pending") {
        underReview = true;
      }
    }

    // Caminho de recuperação: pago mas ainda não recarregado (inclui awaiting_credits/failed)
    if (
      liveStatus === "paid" &&
      p.recharge_status !== "recharged" &&
      p.recharge_status !== "processing"
    ) {
      await callProcessRecharge(p.id);
    }

    // Re-fetch após possíveis atualizações
    const { data: fresh } = await supabase
      .from("reseller_credit_purchases")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const r = fresh || p;
    return new Response(
      JSON.stringify({
        id: r.id,
        status: r.status,
        recharge_status: r.recharge_status,
        package_credits: r.package_credits,
        amount: r.amount,
        warez_username: r.warez_username,
        error_message: r.error_message,
        paid_at: r.paid_at,
        recharged_at: r.recharged_at,
        qr_code_url: r.qr_code_url,
        qr_code_text: r.qr_code_text,
        qr_code_expires_at: r.qr_code_expires_at,
        under_review: underReview,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[reseller-check-status] error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
