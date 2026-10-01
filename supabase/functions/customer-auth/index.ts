// Customer-area password: optional alternative to the OTP code.
// Actions: "login" (identifier + password), "set" (full session), "status" (full session).
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { jsonResponse as json, securityHeadersFor } from "../_shared/security.ts";
import { signCustomerToken, getCustomerSession, isCustomerSession } from "../_shared/auth.ts";
import { tgSearchCustomers, tgGetCustomersByIds, sanitizeCustomerForClient, applyTelasOverride } from "../_shared/tg.ts";
import { classifyIdentifier, customerMatchesIdentifier } from "../_shared/otp.ts";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const ITERATIONS = 100_000;

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("login"), identifier: z.string().min(1).max(120), password: z.string().min(1).max(128) }),
  z.object({ action: z.literal("set"), password: z.string().min(6).max(128) }),
  z.object({ action: z.literal("status") }),
]);

const toHex = (b: ArrayBuffer | Uint8Array) =>
  Array.from(b instanceof Uint8Array ? b : new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
  return toHex(bits);
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: securityHeadersFor(req) });
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Dados inválidos." }, 400, {}, req);
    const body = parsed.data;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (body.action === "set" || body.action === "status") {
      const session = await getCustomerSession(req);
      if (!session || !isCustomerSession(session)) return json({ error: "Sessão inválida." }, 401, {}, req);
      const customerId = Number(session.sub);
      if (body.action === "status") {
        const { data } = await supabase.from("customer_passwords").select("customer_id").eq("customer_id", customerId).maybeSingle();
        return json({ has_password: !!data }, 200, {}, req);
      }
      const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
      const password_hash = await hashPassword(body.password, salt);
      const { error } = await supabase.from("customer_passwords").upsert(
        { customer_id: customerId, password_hash, salt, failed_attempts: 0, locked_until: null },
        { onConflict: "customer_id" },
      );
      if (error) throw error;
      return json({ ok: true }, 200, {}, req);
    }

    // login
    const { isTextual, key } = classifyIdentifier(body.identifier.trim());
    let customers = await tgSearchCustomers(key);
    if (isTextual && customers.length === 0 && key.includes("@")) {
      const local = key.split("@")[0];
      if (local.length >= 3) customers = await tgSearchCustomers(local);
    }
    const matches = customers.filter((c) => customerMatchesIdentifier(c, key, isTextual));
    const ids = matches.map((c) => Number(c.id)).filter(Boolean);
    const invalid = () => json({ error: "Usuário ou senha incorretos." }, 401, {}, req);
    if (ids.length === 0) return invalid();

    const { data: rows } = await supabase.from("customer_passwords").select("*").in("customer_id", ids);
    if (!rows || rows.length === 0) return json({ error: "Essa conta ainda não tem senha. Entre com o código de acesso." }, 404, {}, req);

    const now = Date.now();
    const okIds: number[] = [];
    let locked = false;
    for (const row of rows) {
      if (row.locked_until && new Date(row.locked_until).getTime() > now) { locked = true; continue; }
      const h = await hashPassword(body.password, row.salt);
      if (safeEqual(h, row.password_hash)) {
        okIds.push(Number(row.customer_id));
        if (row.failed_attempts) await supabase.from("customer_passwords").update({ failed_attempts: 0, locked_until: null }).eq("customer_id", row.customer_id);
      } else {
        const fails = (row.failed_attempts ?? 0) + 1;
        await supabase.from("customer_passwords").update({
          failed_attempts: fails >= MAX_FAILS ? 0 : fails,
          locked_until: fails >= MAX_FAILS ? new Date(now + LOCK_MINUTES * 60_000).toISOString() : null,
        }).eq("customer_id", row.customer_id);
      }
    }
    if (okIds.length === 0) {
      if (locked) return json({ error: "Muitas tentativas erradas. Aguarde 15 minutos ou entre com o código." }, 429, {}, req);
      return invalid();
    }

    const okCustomers = matches.filter((c) => okIds.includes(Number(c.id)));
    const fresh = okCustomers.length ? okCustomers : await tgGetCustomersByIds(okIds);
    const accounts = await Promise.all(fresh.map(async (c) => ({
      token: await signCustomerToken(Number(c.id), "customer"),
      customer: sanitizeCustomerForClient(await applyTelasOverride(supabase, c)),
    })));
    return json({ accounts }, 200, {}, req);
  } catch (err) {
    console.error("[customer-auth] error", err instanceof Error ? err.message : err);
    return json({ error: "Não foi possível entrar agora." }, 500, {}, req);
  }
});
