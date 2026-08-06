import { corsHeaders as baseCors } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { tgSearchCustomers } from "../_shared/tg.ts";
import { sendWhatsappText } from "../_shared/uazapi.ts";
import { generateOtpCode, hashOtp, onlyDigits, phoneKey } from "../_shared/otp.ts";

const corsHeaders = {
  ...baseCors,
  "Access-Control-Allow-Headers": `${baseCors["Access-Control-Allow-Headers"] ?? "authorization, x-client-info, apikey, content-type"}, x-customer-token`,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const CODE_TTL_MINUTES = 5;
const MAX_REQUESTS_PER_WINDOW = 3;
const WINDOW_MINUTES = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const raw = typeof body.phone === "string" ? body.phone.trim().slice(0, 100) : "";
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
    const digits = onlyDigits(raw).slice(0, 13);

    if (!isEmail && (digits.length < 10 || digits.length > 13)) {
      return json({ error: "Informe um número de WhatsApp válido ou e-mail." }, 400);
    }

    const key = isEmail ? raw.toLowerCase().trim() : phoneKey(digits);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limit per identifier
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await supabase
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("phone", key)
      .gte("created_at", since);

    if ((count ?? 0) >= MAX_REQUESTS_PER_WINDOW) {
      return json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, 429);
    }

    const customers = await tgSearchCustomers(isEmail ? raw.slice(0, 100) : digits);
    const matches = customers.filter((c) => {
      if (isEmail) {
        const cEmail = String(c.email || "").toLowerCase().trim();
        return cEmail === key;
      }
      return [c.whatsapp, c.celular, c.phone, c.telefone]
        .filter(Boolean)
        .map((v) => phoneKey(String(v)))
        .some((p) => p === key);
    });

    const getGenericOk = (hint?: string) => ({
      ok: true,
      expires_in: CODE_TTL_MINUTES * 60,
      message: isEmail 
        ? "Se o e-mail estiver cadastrado, você receberá um código no WhatsApp vinculado à conta." 
        : "Se o número estiver cadastrado, você receberá um código no WhatsApp.",
      target_hint: hint,
    });

    if (matches.length === 0) {
      // Do not reveal whether the account exists.
      return json(getGenericOk());
    }

    const targetPhoneRaw = String(matches[0].whatsapp || matches[0].celular || matches[0].phone || matches[0].telefone || "");
    const targetPhoneDigits = onlyDigits(targetPhoneRaw);
    const targetHint = targetPhoneDigits.length >= 4 
      ? `****-${targetPhoneDigits.slice(-4)}` 
      : targetPhoneDigits;

    const code = generateOtpCode();
    const code_hash = await hashOtp(code, key);

    // Invalidate previous pending codes for this phone
    await supabase
      .from("otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("phone", key)
      .is("consumed_at", null);

    const { error: insertError } = await supabase.from("otp_codes").insert({
      phone: key,
      customer_id: Number(matches[0].id),
      code_hash,
      expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    if (insertError) throw insertError;

    const firstName = String(matches[0].name ?? "").trim().split(/\s+/)[0] || "";
    const text =
      `🔐 *Loreall Play* — código de acesso\n\n` +
      `${firstName ? `Olá, ${firstName}! ` : ""}Seu código é:\n\n` +
      `*${code}*\n\n` +
      `Válido por ${CODE_TTL_MINUTES} minutos. Nunca compartilhe este código com ninguém.`;

    // Always send to the first match's WhatsApp number (TopGestor primary contact)
    const sent = await sendWhatsappText(targetPhoneDigits || digits, text);
    if (!sent) return json({ error: "Não foi possível enviar o código agora. Tente novamente." }, 502);

    return json(getGenericOk(targetHint));
  } catch (err) {
    console.error("[otp-request] error", err instanceof Error ? err.message : err);
    return json({ error: "Não foi possível enviar o código." }, 500);
  }
});
