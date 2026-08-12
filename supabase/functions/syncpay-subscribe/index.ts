// Cria um assinante SyncPay diretamente pela API e retorna QR Code + copia-e-cola.
// Endpoint: POST /api/partner/v1/subscription-plans/{plan_token}/enroll
//
// Body esperado:
// { plan_id (uuid local), customer_id, name, email, document, phone }

import { createClient } from "npm:@supabase/supabase-js@2";
import { securityHeadersFor, jsonResponse as json } from "../_shared/security.ts";

const SP_BASE = "https://api.syncpayments.com.br/api/partner/v1";

// Funções ok/err removidas em favor do jsonResponse compartilhado

// ------- validators -------
function onlyDigits(s: string) { return String(s || "").replace(/\D/g, ""); }
function validCPF(cpfStr: string): boolean {
  const cpf = onlyDigits(cpfStr);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(cpf[i]) * (10 - i);
  let d1 = (s * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(cpf[i]) * (11 - i);
  let d2 = (s * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10]);
}
function validCNPJ(v: string): boolean {
  const c = onlyDigits(v);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (base: string, weights: number[]) => {
    let s = 0;
    for (let i = 0; i < weights.length; i++) s += parseInt(base[i]) * weights[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(c.slice(0, 12), w1);
  if (d1 !== parseInt(c[12])) return false;
  const d2 = calc(c.slice(0, 13), w2);
  return d2 === parseInt(c[13]);
}
function validDoc(v: string): boolean {
  const d = onlyDigits(v);
  if (d.length === 11) return validCPF(d);
  if (d.length === 14) return validCNPJ(d);
  return false;
}
function validEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function maskDocument(value: string) {
  const digits = onlyDigits(value);
  return digits.length <= 4 ? "***" : `${digits.slice(0, 3)}***${digits.slice(-2)}`;
}
function technicalError(status: number, data: Record<string, unknown>) {
  const source = data?.message || data?.error || data?.errors || `SyncPay ${status}`;
  return typeof source === "string" ? source : JSON.stringify(source);
}

// ------- token -------
let tokenCache: { token: string; exp: number } | null = null;
async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.token;
  const clientId = Deno.env.get("SYNCPAY_CLIENT_ID");
  const clientSecret = Deno.env.get("SYNCPAY_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("SYNCPAY credentials missing");
  const res = await fetch(`${SP_BASE}/auth-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`SyncPay auth ${res.status}: ${JSON.stringify(data)}`);
  const token = data.access_token || data.token || data.data?.access_token || data.data?.token;
  if (!token) throw new Error("SyncPay auth response without access token");
  const expiresIn = Number(data.expires_in || data.data?.expires_in || 3600);
  tokenCache = { token, exp: Date.now() + (expiresIn - 60) * 1000 };
  return token;
}

async function syncpayFetch(path: string, payload: Record<string, string>) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getToken();
    const response = await fetch(`${SP_BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status !== 401 || attempt === 1) return { response, data };
    tokenCache = null; // refresh only once after an unauthorized response
  }
  throw new Error("Unreachable SyncPay retry state");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: securityHeadersFor(req) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, {}, req);

  try {
    const body = await req.json().catch(() => ({}));
    const {
      plan_id, customer_id, name, email, cpf, phone,
    } = body as Record<string, string | number>;

    if (!plan_id) return json({ error: "plan_id obrigatório" }, 400, {}, req);
    if (!name || String(name).trim().length < 3) return json({ error: "Nome inválido" }, 400, {}, req);
    if (!email || !validEmail(String(email))) return json({ error: "E-mail inválido" }, 400, {}, req);
    if (!cpf || !validDoc(String(cpf))) return json({ error: "CPF ou CNPJ inválido" }, 400, {}, req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Busca plano local para obter syncpay_plan_id (token) e amount
    const { data: plan, error: pErr } = await supabase
      .from("syncpay_plans")
      .select("id, syncpay_plan_id, name, amount, billing_method, checkout_url, topgestor_plan_id")
      .eq("id", plan_id)
      .maybeSingle();
    if (pErr || !plan) return json({ error: "Plano não encontrado" }, 404, {}, req);
    const planToken = plan.syncpay_plan_id;
    if (!planToken) return json({ error: "Plano sem token SyncPay" }, 422, {}, req);

    const payload = {
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      document: onlyDigits(String(cpf)),
      phone: (() => {
        let p = onlyDigits(String(phone || ""));
        if (p.length > 11 && p.startsWith("55")) p = p.slice(2);
        return p;
      })(),
    };

    // /enroll is the in-app programmatic flow. Do not replace errors with checkout_url.
    const { response: spRes, data: spData } = await syncpayFetch(
      `/subscription-plans/${encodeURIComponent(String(planToken))}/enroll`, payload,
    );

    if (!spRes.ok) {
      console.error("[syncpay-subscribe] SyncPay recusou", {
        status: spRes.status, planToken: String(planToken), document: maskDocument(payload.document), response: spData,
      });
      return json({ error: technicalError(spRes.status, spData), syncpay_status: spRes.status }, spRes.status, {}, req);
    }

    const sub = spData.data || spData.subscription || spData;
    const subId = sub.subscription_token || sub.id || sub.token || sub.subscription_id;
    
    // O campo 'payment' vem aninhado no /enroll
    const payment = sub.payment || sub.charge || sub.first_charge || spData.charge || {};
    
    // Pix Copia-e-Cola (qr_code)
    const qrText = payment.pix_code || payment.qr_code || payment.qrcode || sub.pix_code || sub.qr_code;
    const qrBase64 = payment.qr_code_base64 || payment.qrcode_base64 || sub.qr_code_base64;
    
    // Pix Automático (pix_automatico)
    const mandateId = payment.mandate_id || sub.mandate_id;
    const mandateStatus = payment.mandate_status || sub.mandate_status;
    const qrCodeMandate = payment.qr_code || sub.qr_code; // Em pix_automatico, o qr_code é para autorização no banco
    
    const authorizationUrl = sub.authorization_url || payment.authorization_url;

    // Registra assinante local
    if (subId) {
      const { error: upsertErr } = await supabase.from("syncpay_subscriptions").upsert({
        syncpay_subscription_id: String(subId),
        syncpay_plan_id: planToken,
        customer_id: customer_id ? Number(customer_id) : null,
        customer_name: payload.name,
        customer_email: payload.email,
        customer_cpf: payload.document,
        customer_phone: payload.phone,
        billing_method: plan.billing_method,
        status: sub.status || spData.status || "pending_first_payment",
        metadata: sub,
      }, { onConflict: "syncpay_subscription_id" });

      if (upsertErr) {
        console.error("[syncpay-subscribe] Erro ao salvar sub no banco:", upsertErr);
      }
    }

    return json({
      subscription_id: subId,
      subscription_status: sub.status || spData.status || "pending_first_payment",
      billing_method: sub.billing_method || spData.billing_method || plan.billing_method,
      qr_code_text: qrText || qrCodeMandate || null,
      qr_code_base64: qrBase64 || null,
      authorization_url: authorizationUrl || null,
      mandate_id: mandateId || null,
      mandate_status: mandateStatus || null,
      amount: Number(plan.amount || 0),
      raw: sub,
    }, 200, {}, req);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[syncpay-subscribe]", message);
    return json({ error: message }, 500, {}, req);
  }
});
