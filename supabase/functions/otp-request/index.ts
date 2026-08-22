import { createClient } from "npm:@supabase/supabase-js@2";
import { tgSearchCustomers } from "../_shared/tg.ts";
import { sendWhatsappText } from "../_shared/uazapi.ts";
import { generateOtpCode, hashOtp, onlyDigits, phoneMatches, classifyIdentifier, customerMatchesIdentifier } from "../_shared/otp.ts";
import { otpRequestSchema } from "../_shared/validation.ts";
import { jsonResponse as json, securityHeadersFor } from "../_shared/security.ts";

const CODE_TTL_MINUTES = 5;
const MAX_REQUESTS_PER_IDENTIFIER = 5;
const MAX_REQUESTS_PER_IP = 15;
const MAX_GLOBAL_PER_MINUTE = 20;
const MAX_GLOBAL_DAILY_OTP = 100000;
const WINDOW_MINUTES = 15;

const FETCH_TIMEOUT = 12000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: securityHeadersFor(req) });

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parse = otpRequestSchema.safeParse(rawBody);
    if (!parse.success) {
      return json({ error: "Dados inválidos.", details: parse.error.format() }, 400, {}, req);
    }
    
    const input = parse.data.phone.trim();
    const context = parse.data.context || "customer";
    const slug = parse.data.slug;
    
    const { isEmail, digits, isTextual, key } = classifyIdentifier(input);
    const isFictitiousEmail = isTextual && !isEmail;
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
      return json({ error: "Muitas tentativas para este identificador. Aguarde alguns minutos." }, 429, {}, req);
    }

    // Intervalo mínimo entre pedidos consecutivos — impede rajadas mesmo dentro do 
    // limite total da janela de 15 minutos.
    const cooldownSince = new Date(Date.now() - 45_000).toISOString();
    const { data: recentRequest } = await supabase
      .from("otp_codes")
      .select("id")
      .eq("phone", key)
      .gte("created_at", cooldownSince)
      .limit(1)
      .maybeSingle();

    if (recentRequest) {
      return json({ error: "Aguarde alguns segundos antes de solicitar um novo código." }, 429, {}, req);
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
        return json({ error: "Limite de tentativas excedido para sua rede. Aguarde." }, 429, {}, req);
      }
    }

    // Freio geral: limite de envios do sistema inteiro por minuto, independente de 
    // quem está pedindo — protege contra rajadas que ameaçam o número de WhatsApp.
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: globalMinuteCount } = await supabase
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .gte("created_at", oneMinuteAgo);

    if ((globalMinuteCount ?? 0) >= MAX_GLOBAL_PER_MINUTE) {
      console.error("[SECURITY] otp-request: limite global por minuto atingido", globalMinuteCount);
      return json({ error: "Sistema com alta demanda no momento. Tente novamente em instantes." }, 429, {}, req);
    }

    let matches: any[] = [];
    let targetPhoneDigits = "";
    let firstName = "";
    let customerId: string | number = 0;

    if (context === "reseller") {

      const matchesIdentifier = (l: { whatsapp: string | null; email: string | null }) => {

        if (isEmail || isFictitiousEmail) {

          return !!l.email && l.email.toLowerCase().trim() === key;

        }

        return !!l.whatsapp && phoneMatches(l.whatsapp, key);

      };

      let link: { id: string; display_name: string; whatsapp: string | null; email: string | null } | null = null;

      if (slug) {

        console.log(`[otp-request] Reseller mode. Slug: ${slug}, Key: ${key}`);

        const { data, error: linkError } = await supabase

          .from("reseller_links")

          .select("id, display_name, whatsapp, email")

          .eq("slug", slug.toLowerCase())

          .maybeSingle();

        if (linkError) throw linkError;

        if (!data) return json({ error: "Revendedor não encontrado." }, 404, {}, req);

        if (!data.whatsapp) {

          return json({ error: "Este revendedor não possui WhatsApp cadastrado para autenticação. Contate o suporte." }, 403, {}, req);

        }

        if (!matchesIdentifier(data)) {

          return json({ error: "WhatsApp ou e-mail incorreto para este revendedor." }, 401, {}, req);

        }

        link = data;

      } else {

        console.log(`[otp-request] Reseller mode sem slug. Buscando por WhatsApp/e-mail. Key: ${key}`);

        const { data: allLinks, error: listError } = await supabase

          .from("reseller_links")

          .select("id, display_name, whatsapp, email")

          .or("whatsapp.not.is.null,email.not.is.null");

        if (listError) throw listError;

        link = (allLinks || []).find(matchesIdentifier) || null;

        if (!link) return json({ error: "Nenhum revendedor encontrado para esse WhatsApp/e-mail." }, 404, {}, req);

        if (!link.whatsapp) {

          return json({ error: "Este revendedor não possui WhatsApp cadastrado para autenticação. Contate o suporte." }, 403, {}, req);

        }

      }

      matches = [link];

      targetPhoneDigits = onlyDigits(link.whatsapp || "");

      firstName = link.display_name;

      customerId = link.id;

    } else {
      // Customer mode (TopGestor)
      console.log(`[otp-request] Customer mode. Searching for: ${key}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      
      let customers = [];
      try {
        customers = await tgSearchCustomers(key);
      } finally {
        clearTimeout(timeoutId);
      }

      if (isTextual && customers.length === 0) {
        const localPart = key.split('@')[0];
        if (localPart.length >= 3) {
          customers = await tgSearchCustomers(localPart);
        }
      }

      matches = customers.filter((c) => customerMatchesIdentifier(c, key, isTextual));

      if (matches.length === 0) {
        const errorMsg = isTextual
          ? "E-mail ou usuário não vinculado a nenhuma conta."
          : "Número não vinculado a nenhuma conta.";
        return json({ error: errorMsg }, 404, {}, req);
      }

      const targetPhoneRaw = String(matches[0].whatsapp || matches[0].celular || matches[0].phone || matches[0].telefone || matches[0].whatsapp_c || "");
      targetPhoneDigits = onlyDigits(targetPhoneRaw);
      firstName = String(matches[0].name ?? "").trim().split(/\s+/)[0] || "";
      customerId = Number(matches[0].id);
    }

    const targetHint = targetPhoneDigits.length >= 4 
      ? `****-${targetPhoneDigits.slice(-4)}` 
      : targetPhoneDigits;

    const code = generateOtpCode();
    const code_hash = await hashOtp(code, key);

    await supabase
      .from("otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("phone", key)
      .is("consumed_at", null);

    const { error: insertError } = await supabase.from("otp_codes").insert({
      phone: key,
      customer_id: typeof customerId === 'number' ? customerId : null,
      reseller_id: typeof customerId === 'string' ? customerId : null,
      matched_customer_ids: context === "customer" ? matches.map((c) => Number(c.id)) : [],
      code_hash,
      expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    if (insertError) throw insertError;

    const text =
      `🔐 *Loreall Play* — Acesso Seguro\n\n` +
      `${firstName ? `Olá, *${firstName}*! ` : ""}Seu código de acesso é:\n\n` +
      `🚀 *${code}*\n\n` +
      `⏱️ Válido por ${CODE_TTL_MINUTES} minutos.`;

    const sent = await sendWhatsappText(targetPhoneDigits || digits, text);
    if (!sent) return json({ error: "Não foi possível enviar o código agora." }, 502, {}, req);

    return json({
      ok: true,
      expires_in: CODE_TTL_MINUTES * 60,
      message: "Código enviado no WhatsApp.",
      target_hint: targetHint,
      customer_name: firstName,
    }, 200, {}, req);

  } catch (err) {
    console.error("[otp-request] error", err instanceof Error ? err.message : err);
    return json({ error: "Não foi possível enviar o código." }, 500, {}, req);
  }
});