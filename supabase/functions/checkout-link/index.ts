// Permanent per-customer renewal checkout links.
// Admin: get (or create), regenerate, send via WhatsApp. Public: resolve token -> renewal-only session.
import { createClient } from "npm:@supabase/supabase-js@2";
import { isAdminRequest, signCustomerToken } from "../_shared/auth.ts";
import { jsonResponse as json, securityHeadersFor } from "../_shared/security.ts";
import { TG_API_BASE, tgHeaders, sanitizeCustomerForClient, applyTelasOverride } from "../_shared/tg.ts";
import { sendWhatsappText } from "../_shared/uazapi.ts";

const PUBLIC_BASE = "https://cliente.loreallplay.com";
const CHECKOUT_TTL = 60 * 60 * 2; // renewal session: 2h
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

function newToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const linkUrl = (token: string) => `${PUBLIC_BASE}/renovar/${token}`;

async function fetchCustomer(id: number): Promise<Record<string, unknown> | null> {
  const r = await fetch(`${TG_API_BASE}/customers/${id}`, { headers: tgHeaders() });
  if (!r.ok) return null;
  const raw = await r.json().catch(() => null);
  const c = (raw?.data ?? raw) as Record<string, unknown> | null;
  return c && c.id ? c : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: securityHeadersFor(req) });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const action = new URL(req.url).searchParams.get("action") || "";
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // ---------- Public: resolve ----------
    if (action === "resolve") {
      const token = String(body.token || "");
      if (!TOKEN_RE.test(token)) return json({ error: "Link inválido." }, 404, {}, req);
      const { data: link } = await supabase
        .from("customer_checkout_links").select("*").eq("token", token).eq("is_active", true).maybeSingle();
      if (!link) return json({ error: "Link inválido ou desativado." }, 404, {}, req);

      const raw = await fetchCustomer(Number(link.customer_id));
      if (!raw) return json({ error: "Cliente não encontrado." }, 404, {}, req);
      const withOverride = await applyTelasOverride(supabase, raw);
      const customer = sanitizeCustomerForClient(withOverride);

      await supabase.from("customer_checkout_links")
        .update({ use_count: (link.use_count || 0) + 1, last_used_at: new Date().toISOString() })
        .eq("id", link.id);

      const session = await signCustomerToken(Number(link.customer_id), "checkout", CHECKOUT_TTL);
      return json({ customer, token: session }, 200, {}, req);
    }

    // ---------- Admin ----------
    if (!isAdminRequest(req)) return json({ error: "unauthorized" }, 401, {}, req);
    const customerId = Number(body.customer_id);
    if (!Number.isInteger(customerId) || customerId <= 0) return json({ error: "customer_id inválido" }, 400, {}, req);

    const getOrCreate = async (regenerate = false) => {
      if (regenerate) {
        await supabase.from("customer_checkout_links").update({ is_active: false }).eq("customer_id", customerId).eq("is_active", true);
      } else {
        const { data } = await supabase.from("customer_checkout_links").select("*")
          .eq("customer_id", customerId).eq("is_active", true).maybeSingle();
        if (data) return data;
      }
      const { data, error } = await supabase.from("customer_checkout_links")
        .insert({ customer_id: customerId, token: newToken(), customer_name: body.customer_name ? String(body.customer_name).slice(0, 120) : null })
        .select("*").single();
      if (error) throw error;
      return data;
    };

    if (action === "get" || action === "regenerate") {
      const link = await getOrCreate(action === "regenerate");
      return json({ url: linkUrl(link.token), link }, 200, {}, req);
    }

    if (action === "send") {
      const link = await getOrCreate(false);
      const customer = await fetchCustomer(customerId);
      const phone = String(customer?.whatsapp || "");
      if (!phone.replace(/\D/g, "")) return json({ error: "Cliente sem WhatsApp cadastrado." }, 400, {}, req);
      const firstName = String(customer?.name || "").split(" ")[0] || "cliente";
      const text =
        `Olá, ${firstName}! 👋\n\nAqui está o seu link exclusivo para renovar seu acesso Loreall Play de forma rápida, via Pix:\n\n` +
        `${linkUrl(link.token)}\n\nA liberação é automática assim que o pagamento é confirmado. ` +
        `Este link é pessoal — não compartilhe.`;
      const ok = await sendWhatsappText(phone, text);
      if (!ok) return json({ error: "Falha ao enviar o WhatsApp." }, 502, {}, req);
      await supabase.from("customer_checkout_links").update({ last_sent_at: new Date().toISOString() }).eq("id", link.id);
      return json({ ok: true, url: linkUrl(link.token) }, 200, {}, req);
    }

    return json({ error: "Invalid action" }, 400, {}, req);
  } catch (e) {
    console.error("[checkout-link]", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500, {}, req);
  }
});
