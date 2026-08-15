import { createClient } from "npm:@supabase/supabase-js@2";
import { signCustomerToken } from "../_shared/auth.ts";
import { tgSearchCustomers, sanitizeCustomerForClient, tgGetCustomersByIds } from "../_shared/tg.ts";
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
    const context = parse.data.context || "customer";
    
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

    if (context === "reseller") {
      // Logic for reseller verification
      const { data: link, error: linkError } = await supabase
        .from("reseller_links")
        .select("id, slug, display_name, whatsapp")
        .or(`reseller_id.eq.${row.reseller_id},id.eq.${row.reseller_id}`) // row.reseller_id is uuid
        .maybeSingle();

      if (linkError || !link) {
        // Fallback: search by phone key again if direct match fails
        const { data: fallbackLink } = await supabase
          .from("reseller_links")
          .select("id, slug, display_name, whatsapp")
          .filter("whatsapp", "ilike", `%${key}`)
          .maybeSingle();
        
        if (!fallbackLink) return json({ error: "Revendedor não encontrado." }, 404, {}, req);
        
        const token = await signCustomerToken(fallbackLink.id, "reseller");
        return json({ 
          accounts: [{
            token,
            customer: { id: fallbackLink.id, name: fallbackLink.display_name, slug: fallbackLink.slug, role: "reseller" }
          }] 
        }, 200, {}, req);
      }

      const token = await signCustomerToken(link.id, "reseller");
      return json({ 
        accounts: [{
          token,
          customer: { id: link.id, name: link.display_name, slug: link.slug, role: "reseller" }
        }] 
      }, 200, {}, req);

    } else {
      // Logic for customer verification
      const searchIdentifier = isEmail ? raw.slice(0, 100) : digits;
      const matchedIds: number[] = Array.isArray(row.matched_customer_ids) ? row.matched_customer_ids : [];
      const customers = matchedIds.length > 0
        ? await tgGetCustomersByIds(matchedIds)
        : await tgSearchCustomers(searchIdentifier); // fallback pra linhas antigas, criadas antes dessa mudança
      const matches = customers.filter((c) => {
        if (isEmail) {
          const cEmail = String(c.email || "").toLowerCase().trim();
          const cName = String(c.name || "").toLowerCase().trim();
          const localPart = key.split('@')[0];
          return cEmail === key || cEmail.includes(localPart) || cName.includes(localPart);
        }
        const phoneFields = [c.whatsapp, c.celular, c.phone, c.telefone, c.whatsapp_c];
        return phoneFields
          .filter(Boolean)
          .map((v) => phoneKey(String(v)))
          .some((p) => p === key);
      });

      if (matches.length === 0) {
        return json({ error: "Conta não encontrada." }, 404, {}, req);
      }

      const accounts = await Promise.all(
        matches.map(async (c) => ({
          token: await signCustomerToken(Number(c.id), "customer"),
          customer: sanitizeCustomerForClient(c),
        })),
      );

      return json({ accounts }, 200, {}, req);
    }
  } catch (err) {
    console.error("[otp-verify] error", err instanceof Error ? err.message : err);
    return json({ error: "Não foi possível validar o código." }, 500, {}, req);
  }
});