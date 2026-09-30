// Sends the login code by e-mail (Resend via connector gateway), branded like the reminders.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "Loreall Play <nao-responda@lembretes.loreallplay.com>";
const LOGO_URL = "https://cliente.loreallplay.com/brand-logo.png";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${"•".repeat(Math.max(2, Math.min(6, user.length - visible.length)))}@${domain}`;
}

export async function sendOtpEmail(to: string, code: string, firstName: string, ttlMin: number): Promise<boolean> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) { console.error("[otp-email] not configured"); return false; }
  const hi = firstName ? `Olá, ${esc(firstName)}!` : "Olá!";
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Seu código de acesso: ${code}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9"><tr><td align="center" style="padding:16px 10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0">
  <tr><td align="center" style="padding:26px 24px 0">
    <img src="${LOGO_URL}" width="52" height="52" alt="Loreall Play" style="display:block;border:0;width:52px;height:52px;margin:0 auto">
    <p style="margin:8px 0 0;color:#0f172a;font-size:17px;font-weight:bold">Loreall Play</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px auto 0"><tr><td width="64" height="3" bgcolor="#2563eb" style="width:64px;height:3px;line-height:3px;font-size:0;background-image:linear-gradient(90deg,#06b6d4,#2563eb,#7c3aed)">&nbsp;</td></tr></table>
  </td></tr>
  <tr><td align="center" style="padding:18px 24px 0">
    <h1 style="margin:0 0 6px;color:#0f172a;font-size:20px">${hi}</h1>
    <p style="margin:0;color:#475569;font-size:14px;line-height:1.55">Use o código abaixo para entrar na sua área do cliente.</p>
  </td></tr>
  <tr><td align="center" style="padding:18px 24px 0">
    <div style="display:inline-block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 22px;font-size:32px;font-weight:bold;letter-spacing:8px;color:#1d4ed8">${code}</div>
    <p style="margin:10px 0 0;color:#64748b;font-size:12px">Válido por ${ttlMin} minutos.</p>
  </td></tr>
  <tr><td align="center" style="padding:18px 24px 22px">
    <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5">Não pediu este código? Ignore este e-mail — sua conta continua segura.<br>Nunca compartilhe este código com ninguém.</p>
  </td></tr>
</table>
<p style="max-width:480px;margin:12px auto 0;color:#94a3b8;font-size:11px;text-align:center">Loreall Play · cliente.loreallplay.com</p>
</td></tr></table></body></html>`;
  try {
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": RESEND_API_KEY },
      body: JSON.stringify({ from: FROM, to: [to], subject: `${code} é seu código de acesso Loreall Play`, html }),
    });
    if (!res.ok) { console.error("[otp-email] failed", res.status, await res.text()); return false; }
    return true;
  } catch (e) {
    console.error("[otp-email] error", e);
    return false;
  }
}
