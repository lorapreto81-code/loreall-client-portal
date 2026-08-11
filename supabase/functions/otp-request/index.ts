import { createClient } from "npm:@supabase/supabase-js@2";
import { tgSearchCustomers } from "../_shared/tg.ts";
import { sendWhatsappText } from "../_shared/uazapi.ts";
import { generateOtpCode, hashOtp, onlyDigits, phoneKey } from "../_shared/otp.ts";
import { otpRequestSchema } from "../_shared/validation.ts";
import { jsonResponse as json, securityHeaders } from "../_shared/security.ts";

const CODE_TTL_MINUTES = 5;
const MAX_REQUESTS_PER_IDENTIFIER = 30;
const MAX_REQUESTS_PER_IP = 100;
const MAX_GLOBAL_DAILY_OTP = 10000;
const WINDOW_MINUTES = 2;



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: securityHeaders });

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parse = otpRequestSchema.safeParse(rawBody);
    if (!parse.success) {
      return json({ error: "Dados inválidos.", details: parse.error.format() }, 400);
    }
    
    const input = parse.data.phone.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    const digits = onlyDigits(input);
    
    // Check for fictitious emails like "Loreallclientes" or "topgesotor@loreal"
    // that might not have @ or domain correctly but were used in the old system.
    const isFictitiousEmail = !isEmail && /^[a-zA-Z0-9_\-\.]+(@[a-zA-Z0-9_\-\.]+)?$/.test(input) && digits.length < 8;

    const key = (isEmail || isFictitiousEmail) ? input.toLowerCase().trim() : phoneKey(digits);
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
      console.warn(`[otp-request] Identifier rate limit hit for: ${key}`);
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
        console.warn(`[otp-request] IP rate limit hit for: ${ip}`);
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



    console.log(`[otp-request] Searching customers for: ${key}`);
    let customers = await tgSearchCustomers(key);
    
    // If e-mail search yielded no results, try searching by the local part of the e-mail as a fallback
    if ((isEmail || isFictitiousEmail) && customers.length === 0) {
      const localPart = key.split('@')[0];
      if (localPart.length >= 3) {
        console.log(`[otp-request] Fallback search for local part: ${localPart}`);
        customers = await tgSearchCustomers(localPart);
      }
    }
    console.log(`[otp-request] Found ${customers.length} total search results.`);
    const matches = customers.filter((c) => {
      const cEmail = String(c.email || "").toLowerCase().trim();
      const cName = String(c.name || "").toLowerCase().trim();
      const localPart = key.split('@')[0];
      
      if (isEmail || isFictitiousEmail) {
        // Broaden match: email equals key OR email contains localPart OR name contains localPart
        const match = cEmail === key || cEmail.includes(localPart) || cName.includes(localPart);
        console.log(`[otp-request] Checking customer "${cName}" (Email: ${cEmail}): match=${match}`);
        return match;
      }
      
      const phoneFields = [c.whatsapp, c.celular, c.phone, c.telefone, c.whatsapp_c];
      return phoneFields
        .filter(Boolean)
        .map((v) => phoneKey(String(v)))
        .some((p) => p === key);
    });
    console.log(`[otp-request] Filtered matches: ${matches.length}`);
    if (matches.length > 0) {
      console.log(`[otp-request] Selected match ID: ${matches[0].id}, Name: ${matches[0].name}`);
    }

    const getGenericOk = (hint?: string, name?: string) => ({
      ok: true,
      expires_in: CODE_TTL_MINUTES * 60,
      message: (isEmail || isFictitiousEmail)
        ? "Se o identificador estiver cadastrado, você receberá um código no WhatsApp vinculado à conta." 
        : "Se o número estiver cadastrado, você receberá um código no WhatsApp.",
      target_hint: hint || null,
      customer_name: name || null,
    });

    if (matches.length === 0) {
      console.log(`[otp-request] No matches found for identifier: ${key}`);
      const errorMsg = isEmail 
        ? "E-mail não vinculado a nenhuma conta. Verifique os dados ou entre em contato com o suporte."
        : "Número não vinculado a nenhuma conta.";
      return json({ error: errorMsg }, 404);
    }

    const targetPhoneRaw = String(matches[0].whatsapp || matches[0].celular || matches[0].phone || matches[0].telefone || matches[0].whatsapp_c || "");
    const targetPhoneDigits = onlyDigits(targetPhoneRaw);
    console.log(`[otp-request] Selected target phone digits: ${targetPhoneDigits}`);
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
      `🔐 *Loreall Play* — Acesso Seguro\n\n` +
      `${firstName ? `Olá, *${firstName}*! ` : ""}Seu código de acesso é:\n\n` +
      `🚀 *${code}*\n\n` +
      `⏱️ Válido por ${CODE_TTL_MINUTES} minutos.`;

    // Always send to the first match's WhatsApp number (TopGestor primary contact)
    const sent = await sendWhatsappText(targetPhoneDigits || digits, text);
    if (!sent) return json({ error: "Não foi possível enviar o código agora. Tente novamente." }, 502);

    return json(getGenericOk(targetHint, firstName));
  } catch (err) {
    console.error("[otp-request] error", err instanceof Error ? err.message : err);
    return json({ error: "Não foi possível enviar o código." }, 500);
  }
});
