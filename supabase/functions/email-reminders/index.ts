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

const LOGO_URL = `${PUBLIC_BASE}/brand-logo.png`;
const SUPPORT_WA = "5583998551952";

interface EmailExtra { usuario?: string; plan?: string; telas?: number }

function buildEmail(name: string, days: number, dueBr: string, url: string, extra: EmailExtra = {}) {
  const firstRaw = name.split(" ")[0] || "cliente";
  const first = esc(firstRaw);
  const copy =
    days === 3 ? {
      subject: `${firstRaw}, seu Loreall Play vence em 3 dias ⏳`,
      preheader: "Renove agora em 1 minuto e não perca nenhum jogo, filme ou episódio.",
      badge: "VENCE EM 3 DIAS", badgeBg: "#0ea5e9",
      title: "Faltam só 3 dias para o seu acesso vencer",
      body: `Seus canais, filmes e séries continuam liberados até <b>${dueBr}</b>. Renove agora com calma, pelo PIX, e garanta que nada será interrompido — nem aquele jogo decisivo, nem o próximo episódio da sua série.`,
      cta: "Renovar agora e ficar tranquilo",
    } : days === 1 ? {
      subject: `⚠️ ${firstRaw}, seu acesso Loreall Play vence amanhã`,
      preheader: "Amanhã seu sinal pode ser cortado. Renove hoje em menos de 1 minuto.",
      badge: "VENCE AMANHÃ", badgeBg: "#f59e0b",
      title: "Amanhã seu acesso vence",
      body: `Seu plano vence em <b>${dueBr}</b>. Para não ficar sem canais, filmes e séries no meio da programação, renove hoje — leva menos de 1 minuto e a liberação é automática.`,
      cta: "Renovar hoje via PIX",
    } : days === 0 ? {
      subject: `🔴 ${firstRaw}, seu Loreall Play vence HOJE`,
      preheader: "Último dia! Renove agora e continue assistindo sem interrupção.",
      badge: "VENCE HOJE", badgeBg: "#ef4444",
      title: "Hoje é o último dia do seu acesso",
      body: `Seu acesso vence <b>hoje (${dueBr})</b>. Renove agora para manter sua conexão ativa e continuar assistindo tudo normalmente. É rápido: escolha o plano, pague no PIX e pronto.`,
      cta: "Renovar agora — não fique sem sinal",
    } : {
      subject: `${firstRaw}, seu acesso Loreall Play venceu — volte a assistir agora`,
      preheader: "Seu acesso venceu ontem. Renove e volte a assistir em segundos.",
      badge: "ACESSO VENCIDO", badgeBg: "#ef4444",
      title: "Sentimos sua falta! Seu acesso venceu",
      body: `Seu plano venceu em <b>${dueBr}</b> e seus canais, filmes e séries foram pausados. A boa notícia: basta renovar pelo PIX que tudo volta a funcionar automaticamente, em segundos.`,
      cta: "Reativar meu acesso agora",
    };

  const row = (k: string, v: string) => `<tr><td style="padding:5px 0;color:#64748b;font-size:13px">${k}</td><td align="right" style="padding:5px 0;color:#0f172a;font-size:13px;font-weight:bold">${v}</td></tr>`;
  const rows: string[] = [];
  if (extra.usuario) rows.push(row("Usuário", esc(extra.usuario)));
  if (extra.plan) rows.push(row("Plano", esc(extra.plan) + (extra.telas ? ` · ${extra.telas} ${extra.telas > 1 ? "telas" : "tela"}` : "")));
  rows.push(row(days < 0 ? "Venceu em" : "Vencimento", dueBr));

  const waMsg = `Olá! Sou ${firstRaw}${extra.usuario ? ` (usuário ${extra.usuario})` : ""}, recebi o lembrete de vencimento da Loreall Play e preciso de ajuda.`;
  const waUrl = `https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent(waMsg)}`;

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${esc(copy.subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(copy.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9"><tr><td align="center" style="padding:16px 10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
  <tr><td height="5" bgcolor="#2563eb" style="height:5px;line-height:5px;font-size:0;background:#2563eb;background-image:linear-gradient(90deg,#06b6d4,#2563eb,#7c3aed)">&nbsp;</td></tr>
  <tr><td align="center" style="padding:22px 24px 6px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px"><img src="${LOGO_URL}" width="44" height="44" alt="Loreall Play" style="display:block;border:0;width:44px;height:44px"></td>
      <td align="left"><p style="margin:0;color:#0f172a;font-size:18px;font-weight:bold">Loreall Play</p><p style="margin:2px 0 0;color:#64748b;font-size:12px">Canais, filmes e séries</p></td>
    </tr></table>
  </td></tr>
  <tr><td align="center" style="padding:14px 24px 0">
    <span style="display:inline-block;background:${copy.badgeBg};color:#ffffff;font-size:11px;font-weight:bold;letter-spacing:1px;padding:6px 14px;border-radius:999px">${copy.badge}</span>
  </td></tr>
  <tr><td align="center" style="padding:14px 24px 0">
    <h1 style="margin:0 0 8px;color:#0f172a;font-size:21px;line-height:1.3">${first}, ${copy.title.charAt(0).toLowerCase() + copy.title.slice(1)}</h1>
    <p style="margin:0;color:#475569;font-size:14px;line-height:1.55">${copy.body}</p>
  </td></tr>
  <tr><td style="padding:18px 24px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f8fafc" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px"><tr><td style="padding:10px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>
    </td></tr></table>
  </td></tr>
  <tr><td align="center" style="padding:20px 24px 0">
    <a href="${url}" style="display:block;background:#2563eb;background-image:linear-gradient(90deg,#06b6d4,#2563eb,#7c3aed);color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:15px 18px;border-radius:12px;text-align:center">${copy.cta}</a>
    <p style="margin:10px 0 0;color:#64748b;font-size:12px">🔒 Pagamento seguro via PIX · Liberação automática</p>
  </td></tr>
  <tr><td align="center" style="padding:18px 24px 22px">
    <p style="margin:0;color:#64748b;font-size:13px">Dúvidas? <a href="${waUrl}" style="color:#16a34a;font-weight:bold;text-decoration:none">Suporte no WhatsApp (83) 99855-1952</a></p>
  </td></tr>
</table>
<p style="max-width:520px;margin:12px auto 0;color:#94a3b8;font-size:11px;line-height:1.5;text-align:center">Link de renovação pessoal — não compartilhe.<br>Loreall Play · cliente.loreallplay.com</p>
</td></tr></table>
</body></html>`;
  return { subject: copy.subject, html };
}

function cleanPlan(raw: string): { plan: string; telas?: number } {
  const m = raw.match(/(\d+)\s*telas?/i);
  const telas = m ? Number(m[1]) : undefined;
  const parts = raw.replace(/\(.*?\)/g, "").split("·").map((s) => s.trim()).filter(Boolean)
    .filter((p) => !/telas?$/i.test(p) && !/^warez$/i.test(p));
  const period = parts.find((p) => /mensal|trimestral|semestral|anual/i.test(p)) ?? parts[0] ?? "Plano";
  return { plan: /^plano/i.test(period) ? period : `Plano ${period}`, telas };
}

function extraFrom(c: Record<string, unknown>): EmailExtra {
  const plan = (c.plan as Record<string, unknown> | undefined)?.name ?? c.plan_name ?? c.plano;
  let telas = Number(c.telas ?? c.connections ?? 0) || undefined;
  let planLabel: string | undefined;
  if (plan) { const cp = cleanPlan(String(plan)); planLabel = cp.plan; telas = cp.telas ?? telas; }
  return { usuario: c.usuario ? String(c.usuario) : undefined, plan: planLabel, telas };
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
      const phone = String(body.phone || "").replace(/\D/g, "");
      const to = String(body.to || "").trim();
      if (!isAdminRequest(req) && to.toLowerCase() !== "loreallplay@gmail.com") return json({ error: "unauthorized" }, 401, {}, req);
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
      const { subject, html } = buildEmail(String(found.name || ""), kindDays, `${d}/${m}/${y}`, url, extraFrom(found));
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
        const { subject, html } = buildEmail(String(c.name || ""), days, `${d}/${m}/${y}`, url, extraFrom(c));

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
