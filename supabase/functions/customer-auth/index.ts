import { signCustomerToken } from "../_shared/auth.ts";
import { tgSearchCustomers, sanitizeCustomerForClient } from "../_shared/tg.ts";
import { loginSchema } from "../_shared/validation.ts";
import { jsonResponse as json, securityHeaders } from "../_shared/security.ts";

const onlyDigits = (s: string) => s.replace(/\D/g, "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: securityHeaders });

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parse = loginSchema.safeParse(rawBody);
    if (!parse.success) {
      return json({ error: "Dados inválidos.", details: parse.error.format() }, 400);
    }
    
    const { identifier, password } = parse.data;


    const isEmail = EMAIL_RE.test(identifier);
    const digits = onlyDigits(identifier);
    const isPhone = !isEmail && digits.length >= 8;
    const query = isEmail ? identifier.toLowerCase() : isPhone ? digits : identifier;

    const customers = await tgSearchCustomers(query);
    const tail8 = digits.slice(-8);

    const matches = customers.filter((c) => {
      if (isEmail) return String(c.email || "").toLowerCase() === identifier.toLowerCase();
      if (isPhone) {
        return [c.whatsapp, c.celular, c.phone, c.telefone]
          .filter(Boolean)
          .map((v) => onlyDigits(String(v)))
          .some((p) => p.slice(-8) === tail8);
      }
      return c.usuario === identifier || c.username === identifier;
    });

    // Credential check: the customer must know their own access password.
    // Constant-time comparison to prevent timing attacks.
    const authenticated = matches.filter((c) => {
      const stored = String(c.password ?? "");
      if (!password || !stored || password.length !== stored.length) return false;
      let result = 0;
      for (let i = 0; i < password.length; i++) {
        result |= password.charCodeAt(i) ^ stored.charCodeAt(i);
      }
      return result === 0;
    });


    if (authenticated.length === 0) {
      return json({ error: "Dados de acesso inválidos." }, 401);
    }

    const accounts = await Promise.all(
      authenticated.map(async (c) => ({
        token: await signCustomerToken(Number(c.id)),
        customer: sanitizeCustomerForClient(c),
      })),
    );

    return json({ accounts });
  } catch (err) {
    console.error("[customer-auth] error", err instanceof Error ? err.message : err);
    return json({ error: "Não foi possível concluir o login." }, 500);
  }
});
