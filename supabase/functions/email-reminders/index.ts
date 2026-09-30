// Daily expiration reminders by e-mail (Resend via connector gateway).
// Sends at D-3, D-1, D0 and D+1 with the customer's personal renewal link.
// Idempotent: email_reminder_log (customer_id, due_date, kind) prevents duplicates.
import { createClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse as json, securityHeadersFor } from "../_shared/security.ts";
import { TG_API_BASE, tgHeaders } from "../_shared/tg.ts";
import { isAdminRequest } from "../_shared/auth.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "Loreall Play <nao-responda@lembretes.loreallplay.com>";
const PUBLIC_BASE = "https://cliente.loreallplay.com";
const KINDS: Record<number, string> = { 3: "d-3", 1: "d-1", 0: "d0", [-1]: "d+1" };

function newToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Days until due date, computed in Fortaleza time (UTC-3).
function daysUntil(due: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(due || "");
  if (!m) return null;
  const target = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const now = new Date(Date.now() - 3 * 3600_000);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86400_000);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function buildEmail(name: string, days: number, dueBr: string, url: string) {
  const first = esc(name.split(" ")[0] || "cliente");
  const subject =
    days === 3 ? "Seu acesso Loreall Play vence em 3 dias"
    : days === 1 ? "Seu acesso Loreall Play vence amanhã"
    : days === 0 ? "Seu acesso Loreall Play vence hoje"
    : "Seu acesso Loreall Play venceu — renove agora";
  const line =
    days > 0 ? `Seu acesso vence em <b>${dueBr}</b>. Renove agora e continue assistindo sem interrupções.`
    : days === 0 ? `Seu acesso vence <b>hoje (${dueBr})</b>. Renove agora para não ficar sem sinal.`
    : `Seu acesso venceu em <b>${dueBr}</b>. Renove em poucos segundos e volte a assistir.`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#ffffff;font-family:Arial,sans-serif;color:#0f172a">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<h1 style="font-size:22px;margin:0 0 16px;color:#1d4ed8">Loreall Play</h1>
<p style="font-size:16px;margin:0 0 12px">Olá, ${first}!</p>
<p style="font-size:15px;line-height:1.5;margin:0 0 24px">${line}</p>
<a href="${url}" style="display:inline-block;background:linear-gradient(90deg,#2563eb,#7c3aed);background-color:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:10px">Renovar agora via PIX</a>
<p style="font-size:13px;color:#64748b;line-height:1.5;margin:24px 0 0">A liberação é automática após o pagamento. Este link é pessoal — não compartilhe.</p>
</div></body></html>`;
  return { subject, html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: securityHeadersFor(req) });
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) return json({ error: "Email not configured" }, 500, {}, req);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Admin-only test: real customer data (found by phone) sent to a test address. No log entry.
  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (body?.test) {
      if (!isAdminRequest(req)) return json({ error: "unauthorized" }, 401, {}, req);
      const phone = String(body.phone || "").replace(/\D/g, "");
      const to = String(body.to || "").trim();
      if (phone.length < 8 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: "invalid input" }, 400, {}, req);
      let found: Record<string, unknown> | null = null;
      for (let page = 1; page <= 100 && !found; page++) {
        const r = await fetch(`${TG_API_BASE}/customers?per_page=100&page=${page}`, { headers: tgHeaders() });
        if (!r.ok) break;
        const j = await r.json().catch(() => null);
        const list: Record<string, unknown>[] = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
        found = list.find((c) => ["whatsapp", "celular", "telefone"].some((k) => {
          const v = String(c[k] || "").replace(/\D/g, "");
          return v && (v.endsWith(phone.slice(-9)) || phone.endsWith(v.slice(-9)));
        })) || null;
        if (list.length < 100) break;
      }
      if (!found) return json({ error: "customer not found" }, 404, {}, req);
      const due = String(found.data_de_vencimento || "").slice(0, 10);
      const days = daysUntil(due) ?? 3;
      const { data: link } = await supabase.from("customer_checkout_links").select("token")
        .eq("customer_id", Number(found.id)).eq("is_active", true).maybeSingle();
      const url = link ? `${PUBLIC_BASE}/renovar/${link.token}` : `${PUBLIC_BASE}/login`;
      const [y, m, d] = due.split("-");
      const kindDays = days in KINDS ? days : days > 0 ? 3 : -1;
      const { subject, html } = buildEmail(String(found.name || ""), kindDays, `${d}/${m}/${y}`, url);
      const res = await fetch(`${GATEWAY_URL}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": RESEND_API_KEY },
        body: JSON.stringify({ from: FROM, to: [to], subject: `[TESTE] ${subject}`, html }),
      });
      const out = await res.text();
      return json({ status: res.status, name: found.name, due, days, has_link: !!link, resend: out.slice(0, 300) }, res.ok ? 200 : 502, {}, req);
    }
  }

  const stats = { scanned: 0, sent: 0, failed: 0, skipped: 0 };
  try {
    for (let page = 1; page <= 100; page++) {
      const r = await fetch(`${TG_API_BASE}/customers?per_page=100&page=${page}`, { headers: tgHeaders() });
      if (!r.ok) { console.error("[email-reminders] TG list failed", r.status, await r.text()); break; }
      const j = await r.json().catch(() => null);
      const list: Record<string, unknown>[] = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
      if (!list.length) break;

      for (const c of list) {
        stats.scanned++;
        const email = String(c.email || "").trim().toLowerCase();
        const due = String(c.data_de_vencimento || "");
        const days = daysUntil(due);
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || days === null || !(days in KINDS)) continue;
        const customerId = Number(c.id);
        const kind = KINDS[days];
        const dueDate = due.slice(0, 10);

        // Reserve the slot first (unique constraint = no duplicate sends).
        const { error: resErr } = await supabase.from("email_reminder_log")
          .insert({ customer_id: customerId, due_date: dueDate, kind, email, status: "sending" });
        if (resErr) { stats.skipped++; continue; }

        let { data: link } = await supabase.from("customer_checkout_links").select("token")
          .eq("customer_id", customerId).eq("is_active", true).maybeSingle();
        if (!link) {
          const ins = await supabase.from("customer_checkout_links")
            .insert({ customer_id: customerId, token: newToken(), customer_name: String(c.name || "").slice(0, 120) || null })
            .select("token").single();
          link = ins.data;
        }
        const url = link ? `${PUBLIC_BASE}/renovar/${link.token}` : `${PUBLIC_BASE}/login`;
        const [y, m, d] = dueDate.split("-");
        const { subject, html } = buildEmail(String(c.name || ""), days, `${d}/${m}/${y}`, url);

        const res = await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({ from: FROM, to: [email], subject, html }),
        });
        if (res.ok) {
          stats.sent++;
          await supabase.from("email_reminder_log").update({ status: "sent" })
            .eq("customer_id", customerId).eq("due_date", dueDate).eq("kind", kind);
        } else {
          stats.failed++;
          const body = await res.text();
          console.error(`[email-reminders] send failed [${res.status}]: ${body}`);
          await supabase.from("email_reminder_log").update({ status: "failed", error: body.slice(0, 500) })
            .eq("customer_id", customerId).eq("due_date", dueDate).eq("kind", kind);
        }
        await new Promise((ok) => setTimeout(ok, 600)); // Resend rate limit (2/s)
      }
      if (list.length < 100) break;
    }
    console.log("[email-reminders]", stats);
    return json(stats, 200, {}, req);
  } catch (e) {
    console.error("[email-reminders]", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno", ...stats }, 500, {}, req);
  }
});
