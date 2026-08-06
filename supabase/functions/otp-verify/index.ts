import { corsHeaders as baseCors } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { signCustomerToken } from "../_shared/auth.ts";
import { tgSearchCustomers } from "../_shared/tg.ts";
import { hashOtp, onlyDigits, phoneKey } from "../_shared/otp.ts";

const corsHeaders = {
  ...baseCors,
  "Access-Control-Allow-Headers": `${baseCors["Access-Control-Allow-Headers"] ?? "authorization, x-client-info, apikey, content-type"}, x-customer-token`,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const raw = typeof body.phone === "string" ? body.phone.trim().slice(0, 100) : "";
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
    const digits = onlyDigits(raw).slice(0, 13);
    const code = onlyDigits(typeof body.code === "string" ? body.code : "").slice(0, 6);

    if ((!isEmail && digits.length < 10) || code.length !== 6) {
      return json({ error: "Dados inválidos." }, 400);
    }

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
    if (!row) return json({ error: "Código expirado. Solicite um novo." }, 401);
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return json({ error: "Código expirado. Solicite um novo." }, 401);
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await supabase.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
      return json({ error: "Muitas tentativas. Solicite um novo código." }, 429);
    }

    const hash = await hashOtp(code, key);
    if (hash !== row.code_hash) {
      await supabase.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return json({ error: "Código incorreto." }, 401);
    }

    await supabase.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);

    const customers = await tgSearchCustomers(isEmail ? raw : digits);
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

    if (matches.length === 0) return json({ error: "Conta não encontrada." }, 404);

    const accounts = await Promise.all(
      matches.map(async (c) => ({
        token: await signCustomerToken(Number(c.id)),
        customer: c,
      })),
    );

    return json({ accounts });
  } catch (err) {
    console.error("[otp-verify] error", err instanceof Error ? err.message : err);
    return json({ error: "Não foi possível validar o código." }, 500);
  }
});
