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

    // Polling ao vivo no Fast Depix se ainda está pendente
    if (p.status === "pending" && p.fastdepix_transaction_id) {
      const apiKey =
        Deno.env.get("FASTDEPIX_RESELLER_API_KEY") || Deno.env.get("FASTDEPIX_API_KEY");
      if (apiKey) {
        try {
          const r = await fetch(`${FAST_BASE}/transactions/${p.fastdepix_transaction_id}`, {
            headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
          });
          if (r.ok) {
            const data = await r.json().catch(() => ({}));
            const tx = data?.data || data;
            const s = String(tx.status || "").toLowerCase();
            const paidStates = ["paid", "approved", "completed", "success", "succeeded"];
            const expiredStates = ["expired", "cancelled", "canceled"];
            const reviewStates = ["under_review", "processing", "in_review", "analyzing", "analysis"];

            if (paidStates.includes(s)) {
              const { data: upd } = await supabase
                .from("reseller_credit_purchases")
                .update({ status: "paid", paid_at: new Date().toISOString() })
                .eq("id", p.id)
                .eq("status", "pending")
                .select()
                .maybeSingle();
              if (upd) {
                liveStatus = "paid";
                await callProcessRecharge(p.id);
              }
            } else if (expiredStates.includes(s)) {
              await supabase
                .from("reseller_credit_purchases")
                .update({ status: "expired" })
                .eq("id", p.id);
              liveStatus = "expired";
            } else if (reviewStates.includes(s)) {
              underReview = true;
            }
          }
        } catch (e) {
          console.error("[reseller-check-status] FD poll error", e);
        }
      }
    }

    // Caminho de recuperação: pago mas ainda não recarregado
    if (liveStatus === "paid" && p.recharge_status !== "recharged" && p.recharge_status !== "processing") {
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
