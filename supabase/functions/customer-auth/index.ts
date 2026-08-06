import { corsHeaders as baseCors } from "npm:@supabase/supabase-js@2/cors";
import { signCustomerToken } from "../_shared/auth.ts";
import { tgSearchCustomers } from "../_shared/tg.ts";

const corsHeaders = { ...baseCors, "Access-Control-Allow-Headers": `${baseCors["Access-Control-Allow-Headers"] ?? "authorization, x-client-info, apikey, content-type"}, x-customer-token` };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const onlyDigits = (s: string) => s.replace(/\D/g, "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!identifier || identifier.length > 120) return json({ error: "Informe seu e-mail, celular ou usuário." }, 400);
    if (!password || password.length > 200) return json({ error: "Informe sua senha." }, 400);

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
    // Use timing-safe comparison or direct value check after filtering.
    const authenticated = matches.filter((c) => {
      const stored = String(c.password ?? "");
      return stored === password && password.length > 0;
    });

    if (authenticated.length === 0) {
      return json({ error: "Dados de acesso inválidos." }, 401);
    }

    const accounts = await Promise.all(
      authenticated.map(async (c) => ({
        token: await signCustomerToken(Number(c.id)),
        customer: c,
      })),
    );

    return json({ accounts });
  } catch (err) {
    console.error("[customer-auth] error", err instanceof Error ? err.message : err);
    return json({ error: "Não foi possível concluir o login." }, 500);
  }
});
