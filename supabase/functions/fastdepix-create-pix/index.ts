import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FAST_BASE = "https://fastdepix.space/api/v1";

interface CreateBody {
  customer_id: number;
  customer_name: string;
  customer_whatsapp?: string;
  plan_id: number;
  plan_name: string;
  amount: number;
}

function parseExpiresAt(raw: string | undefined | null): string {
  if (!raw) return new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const hasTz = /(?:Z|[+-]\d{2}:\d{2})\s*$/.test(raw);
  try {
    return hasTz
      ? new Date(raw).toISOString()
      : new Date(raw.trim().replace(" ", "T") + "-03:00").toISOString();
  } catch {
    return new Date(Date.now() + 15 * 60 * 1000).toISOString();
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("FASTDEPIX_API_KEY");
    if (!apiKey) throw new Error("FASTDEPIX_API_KEY not configured");

    const body = (await req.json()) as CreateBody;

    // Basic validation
    if (!body.customer_id || !body.plan_id || !body.amount) {
      return new Response(JSON.stringify({ error: "customer_id, plan_id e amount são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.amount < 10) {
      return new Response(JSON.stringify({ error: "Valor mínimo R$ 10,00" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.amount >= 500) {
      return new Response(
        JSON.stringify({
          error: "PIX indisponível para valores ≥ R$ 500. Use o link de pagamento alternativo.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cria transação no Fast Depix (anônima, valores < R$ 500)
    const fdRes = await fetch(`${FAST_BASE}/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount: Number(body.amount.toFixed(2)),
        user: { name: body.customer_name },
      }),
    });

    const fdData = await fdRes.json().catch(() => ({}));
    if (!fdRes.ok) {
      console.error("[fastdepix-create-pix] FD error", fdRes.status, fdData);
      return new Response(
        JSON.stringify({ error: fdData?.message || "Erro ao criar transação Fast Depix", details: fdData }),
        { status: fdRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tx = fdData?.data || fdData;
    const expiresAt = parseExpiresAt(tx.qr_code_expires_at);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: inserted, error: insertErr } = await supabase
      .from("payments")
      .insert({
        customer_id: body.customer_id,
        customer_name: body.customer_name,
        customer_whatsapp: body.customer_whatsapp ?? null,
        plan_id: body.plan_id,
        plan_name: body.plan_name,
        amount: body.amount,
        fastdepix_transaction_id: tx.id,
        fastdepix_status: tx.status || "pending",
        qr_code_url: tx.qr_code,
        qr_code_text: tx.qr_code_text,
        qr_code_expires_at: expiresAt,
        metadata: { fastdepix_raw: tx },
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[fastdepix-create-pix] DB insert error", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        payment_id: inserted.id,
        qr_code_url: inserted.qr_code_url,
        qr_code_text: inserted.qr_code_text,
        expires_at: inserted.qr_code_expires_at,
        amount: inserted.amount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[fastdepix-create-pix] error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
