import { createClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse as json, securityHeadersFor, checkRateLimit } from "../_shared/security.ts";

const SP_BASE = "https://api.syncpayments.com.br/api/partner/v1";

function creditPrice(credits: number): number {
  if (credits >= 1000) return 5.50;
  if (credits >= 500) return 6.00;
  if (credits >= 100) return 7.00;
  if (credits >= 50) return 8.00;
  if (credits >= 30) return 10.00;
  return 11.00; // 10-29 (mínimo de 10 é obrigatório, imposto pela própria Warez)
}

function onlyDigits(s: string): string { return String(s || "").replace(/\D/g, ""); }
function validEmail(e: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

let syncToken: { token: string; expiresAt: number } | null = null;
async function getSyncToken(): Promise<string> {
  if (syncToken && syncToken.expiresAt > Date.now() + 60_000) return syncToken.token;
  const clientId = Deno.env.get("SYNCPAY_CLIENT_ID");
  const clientSecret = Deno.env.get("SYNCPAY_CLIENT_SECRET");
  const res = await fetch(`${SP_BASE}/auth-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`SyncPay auth ${res.status}`);
  syncToken = { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in || 3600) - 60) * 1000 };
  return syncToken.token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: securityHeadersFor(req) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, {}, req);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const allowed = await checkRateLimit(supabase, ip, "reseller-signup", 5, 60);
    if (!allowed) return json({ error: "Muitas tentativas. Aguarde um pouco." }, 429, {}, req);

    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const desired_username = String(body.usuario || "").trim();
    const desired_password = String(body.password || "").trim();
    const whatsapp = onlyDigits(String(body.whatsapp || ""));
    const credits = Number(body.credits || 0);

    if (name.length < 3) return json({ error: "Nome inválido" }, 400, {}, req);
    if (!validEmail(email)) return json({ error: "E-mail inválido" }, 400, {}, req);
    if (desired_username.length < 3 || desired_username.length > 32) return json({ error: "Usuário inválido (3-32 caracteres)" }, 400, {}, req);
    if (desired_password.length < 4 || desired_password.length > 32) return json({ error: "Senha inválida" }, 400, {}, req);
    if (whatsapp.length < 10 || whatsapp.length > 13) return json({ error: "WhatsApp inválido" }, 400, {}, req);
    if (!Number.isInteger(credits) || credits < 10) return json({ error: "Mínimo de 10 créditos" }, 400, {}, req);

    const pricePerCredit = creditPrice(credits);
    const amount = Number((credits * pricePerCredit).toFixed(2));

    const { data: signup, error: insErr } = await supabase
      .from("reseller_signups")
      .insert({ name, email, desired_username, desired_password, whatsapp, credits, amount, ip_address: ip })
      .select()
      .single();
    if (insErr || !signup) return json({ error: "Erro ao registrar cadastro" }, 500, {}, req);

    const token = await getSyncToken();
    const spRes = await fetch(`${SP_BASE}/cash-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        amount,
        description: `Criação de revenda — ${credits} créditos`,
        payer: { name, email },
      }),
    });
    const spData = await spRes.json().catch(() => ({}));
    if (!spRes.ok) {
      console.error("[reseller-signup] SyncPay falhou", spRes.status, spData);
      return json({ error: "Não foi possível gerar o Pix. Tente novamente." }, 502, {}, req);
    }

    const tx = spData.data || spData;
    await supabase.from("reseller_signups").update({
      fastdepix_transaction_id: tx.id || tx.identifier || null,
      qr_code_url: tx.qr_code_url || tx.qrcode_url || null,
      qr_code_text: tx.qr_code || tx.pix_code || tx.qrcode || null,
      qr_code_expires_at: tx.expires_at || tx.qr_code_expires_at || null,
    }).eq("id", signup.id);

    return json({
      signup_id: signup.id,
      amount,
      credits,
      price_per_credit: pricePerCredit,
      qr_code_url: tx.qr_code_url || tx.qrcode_url || null,
      qr_code_text: tx.qr_code || tx.pix_code || tx.qrcode || null,
      expires_at: tx.expires_at || tx.qr_code_expires_at || null,
    }, 200, {}, req);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[reseller-signup]", message);
    return json({ error: message }, 500, {}, req);
  }
});
