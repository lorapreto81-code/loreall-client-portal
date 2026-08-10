import { createClient } from "npm:@supabase/supabase-js@2";
import { tgSearchCustomers } from "../_shared/tg.ts";
import { sendWhatsappText } from "../_shared/uazapi.ts";
import { generateOtpCode, hashOtp, onlyDigits, phoneKey } from "../_shared/otp.ts";
import { otpRequestSchema } from "../_shared/validation.ts";
import { jsonResponse as json, securityHeaders } from "../_shared/security.ts";

const CODE_TTL_MINUTES = 5;
const MAX_REQUESTS_PER_IDENTIFIER = 3;
const MAX_REQUESTS_PER_IP = 10;
const MAX_GLOBAL_DAILY_OTP = 1000;
const WINDOW_MINUTES = 10;



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: securityHeaders });

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parse = otpRequestSchema.safeParse(rawBody);
    if (!parse.success) {
      return json({ error: "Dados inválidos.", details: parse.error.format() }, 400);
    }
    
    const raw = parse.data.phone.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
    const digits = onlyDigits(raw);


    const key = isEmail ? raw.toLowerCase().trim() : phoneKey(digits);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limit per identifier
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { count: identifierCount } = await supabase
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("phone", key)
      .gte("created_at", since);

    if ((identifierCount ?? 0) >= MAX_REQUESTS_PER_IDENTIFIER) {
      return json({ error: "Muitas tentativas para este identificador. Aguarde alguns minutos." }, 429);
    }

    // Rate limit per IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    if (ip) {
      const { count: ipCount } = await supabase
        .from("otp_codes")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", ip)
        .gte("created_at", since);
      
      if ((ipCount ?? 0) >= MAX_REQUESTS_PER_IP) {
        return json({ error: "Limite de tentativas excedido para sua rede. Aguarde." }, 429);
      }
    }

    // Global daily rate limit to prevent mass spam/billing exhaustion
    const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { count: globalCount } = await supabase
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo);

    if ((globalCount ?? 0) >= MAX_GLOBAL_DAILY_OTP) {
      console.error("[SECURITY] Global OTP daily limit reached!");
      return json({ error: "Serviço temporariamente indisponível. Tente mais tarde." }, 503);
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

    const getGenericOk = (hint?: string, name?: string) => ({
      ok: true,
      expires_in: CODE_TTL_MINUTES * 60,
      message: isEmail 
        ? "Se o e-mail estiver cadastrado, você receberá um código no WhatsApp vinculado à conta." 
        : "Se o número estiver cadastrado, você receberá um código no WhatsApp.",
      target_hint: hint,
      customer_name: name,
    });

    if (matches.length === 0) {
      // Do not reveal whether the account exists, but if we don't have a hint, we can't show it.
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

    return json(getGenericOk(targetHint, firstName));
  } catch (err) {
    console.error("[otp-request] error", err instanceof Error ? err.message : err);
    return json({ error: "Não foi possível enviar o código." }, 500);
  }
});
