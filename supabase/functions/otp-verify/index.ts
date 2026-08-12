import { createClient } from "npm:@supabase/supabase-js@2";
import { signCustomerToken } from "../_shared/auth.ts";
import { tgSearchCustomers, sanitizeCustomerForClient } from "../_shared/tg.ts";
import { hashOtp, onlyDigits, phoneKey } from "../_shared/otp.ts";
import { otpVerifySchema } from "../_shared/validation.ts";
import { jsonResponse as json, securityHeadersFor } from "../_shared/security.ts";

const MAX_ATTEMPTS = 5;


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: securityHeadersFor(req) });

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parse = otpVerifySchema.safeParse(rawBody);
    if (!parse.success) {
      return json({ error: "Dados inválidos.", details: parse.error.format() }, 400, {}, req);
    }
    
    const raw = parse.data.phone.trim();
    const code = onlyDigits(parse.data.code);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
    const digits = onlyDigits(raw);


    const key = isEmail ? raw.toLowerCase().trim() : phoneKey(digits);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rows } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", key)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const row = rows?.[0];
    if (!row) return json({ error: "Código expirado. Solicite um novo." }, 401, {}, req);
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return json({ error: "Código expirado. Solicite um novo." }, 401, {}, req);
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await supabase.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
      return json({ error: "Muitas tentativas. Solicite um novo código." }, 429, {}, req);
    }

    const hash = await hashOtp(code, key);
    if (hash !== row.code_hash) {
      await supabase.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return json({ error: "Código incorreto." }, 401, {}, req);
    }

    await supabase.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);

    const searchIdentifier = isEmail ? raw.slice(0, 100) : digits;
    console.log(`[otp-verify] Searching customers for verification: ${searchIdentifier}`);
    const customers = await tgSearchCustomers(searchIdentifier);
    console.log(`[otp-verify] Found ${customers.length} total search results.`);
    const matches = customers.filter((c) => {
      if (isEmail) {
        const cEmail = String(c.email || "").toLowerCase().trim();
        const cName = String(c.name || "").toLowerCase().trim();
        const localPart = key.split('@')[0];
        // Broaden match: email equals key OR email contains localPart OR name contains localPart
        const match = cEmail === key || cEmail.includes(localPart) || cName.includes(localPart);
        console.log(`[otp-verify] Checking customer "${cName}" (Email: ${cEmail}): match=${match}`);
        return match;
      }
      const phoneFields = [c.whatsapp, c.celular, c.phone, c.telefone, c.whatsapp_c];
      return phoneFields
        .filter(Boolean)
        .map((v) => phoneKey(String(v)))
        .some((p) => p === key);
    });

    if (matches.length === 0) {
      console.warn(`[otp-verify] No matches found for ${key} after code validation.`);
      return json({ error: "Conta não encontrada." }, 404, {}, req);
    }

    const accounts = await Promise.all(
      matches.map(async (c) => ({
        token: await signCustomerToken(Number(c.id)),
        customer: sanitizeCustomerForClient(c),
      })),
    );

    return json({ accounts }, 200, {}, req);
  } catch (err) {
    console.error("[otp-verify] error", err instanceof Error ? err.message : err);
    return json({ error: "Não foi possível validar o código." }, 500, {}, req);
  }
});
