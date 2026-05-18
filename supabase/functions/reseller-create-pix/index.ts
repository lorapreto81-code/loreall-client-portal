import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FAST_BASE = "https://fastdepix.space/api/v1";

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

function normalizeWhatsapp(raw: string | undefined): string {
  if (!raw) return "";
  const digits = String(raw).replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length >= 10 && digits.length <= 11) return "55" + digits;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey =
      Deno.env.get("FASTDEPIX_RESELLER_API_KEY") || Deno.env.get("FASTDEPIX_API_KEY");
    if (!apiKey) throw new Error("FASTDEPIX_API_KEY not configured");

    const body = await req.json().catch(() => ({}));
    const slug = String(body.slug || "").trim().toLowerCase();
    if (!slug) {
      return new Response(JSON.stringify({ error: "slug é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link, error: linkErr } = await supabase
      .from("reseller_links")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (linkErr) throw linkErr;
    if (!link) {
      return new Response(JSON.stringify({ error: "Revendedor não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const whatsapp = normalizeWhatsapp(body.whatsapp);
    const finalEmail =
      String(body.email || "").trim().toLowerCase() || `${slug}@renovartv.app`;
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      null;

    const minC = Number(link.min_credits ?? 10);
    const maxC = Number(link.max_credits ?? 30);
    const price = Number(link.price_per_credit ?? link.amount / (link.credits || 1));
    const requested = Number.isFinite(Number(body.credits)) ? Math.floor(Number(body.credits)) : Number(link.credits);
    const credits = Math.max(minC, Math.min(maxC, requested));
    const amount = Number((credits * price).toFixed(2));

    // Create Fast Depix transaction
    const fdRes = await fetch(`${FAST_BASE}/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount,
        description: `Recarga ${credits} créditos - ${link.warez_username}`,
        user: { name: link.warez_username, email: finalEmail },
      }),
    });

    const fdData = await fdRes.json().catch(() => ({}));
    if (!fdRes.ok) {
      console.error("[reseller-create-pix] FD error", fdRes.status, fdData);
      return new Response(
        JSON.stringify({
          error: fdData?.message || "Erro ao criar PIX no Fast Depix",
          details: fdData,
        }),
        { status: fdRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tx = fdData?.data || fdData?.transaction || fdData;
    const expiresAt = parseExpiresAt(tx.qr_code_expires_at);

    const { data: inserted, error: insertErr } = await supabase
      .from("reseller_credit_purchases")
      .insert({
        reseller_link_id: link.id,
        warez_username: link.warez_username,
        warez_user_id: link.warez_user_id,
        whatsapp,
        email: finalEmail,
        package_credits: link.credits,
        amount,
        fastdepix_transaction_id: tx.id,
        qr_code_url: tx.qr_code,
        qr_code_text: tx.qr_code_text,
        qr_code_expires_at: expiresAt,
        status: "pending",
        recharge_status: "pending",
        ip_address: ipAddress,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({
        success: true,
        purchase_id: inserted.id,
        qr_code_url: inserted.qr_code_url,
        qr_code_text: inserted.qr_code_text,
        expires_at: inserted.qr_code_expires_at,
        amount: inserted.amount,
        package_credits: inserted.package_credits,
        warez_username: inserted.warez_username,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[reseller-create-pix] error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
