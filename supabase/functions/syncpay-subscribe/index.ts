// Cria um assinante SyncPay diretamente pela API e retorna QR Code + copia-e-cola.
// Endpoint: POST /api/partner/v1/subscription-plans/{plan_token}/subscribers
//
// Body esperado:
// { plan_id (uuid local), customer_id, name, email, cpf, phone }

import { createClient } from "npm:@supabase/supabase-js@2";
import { securityHeadersFor, jsonResponse as json } from "../_shared/security.ts";

const SP_BASE = "https://api.syncpayments.com.br/api/partner/v1";

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(message: string, status = 400, extra?: unknown) {
  return new Response(JSON.stringify({ error: message, ...(extra ? { detail: extra } : {}) }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
  const expiresIn = Number(data.expires_in || data.data?.expires_in || 3600);
  tokenCache = { token, exp: Date.now() + (expiresIn - 60) * 1000 };
  return token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return err("Method not allowed", 405);

  try {
    const body = await req.json().catch(() => ({}));
    const {
      plan_id, customer_id, name, email, cpf, phone,
    } = body as Record<string, string | number>;

    if (!plan_id) return err("plan_id obrigatório");
    if (!name || String(name).trim().length < 3) return err("Nome inválido");
    if (!email || !validEmail(String(email))) return err("E-mail inválido");
    if (!cpf || !validDoc(String(cpf))) return err("CPF ou CNPJ inválido");

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
    if (pErr || !plan) return err("Plano não encontrado", 404);
    const planToken = plan.syncpay_plan_id;
    if (!planToken) return err("Plano sem token SyncPay", 422);

    const token = await getToken();
    const payload = {
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      cpf: onlyDigits(String(cpf)),
      phone: onlyDigits(String(phone || "")),
      charge_now: true,
    };

    const spRes = await fetch(`${SP_BASE}/subscription-plans/${planToken}/subscribers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    const spData = await spRes.json().catch(() => ({}));

    if (!spRes.ok) {
      console.error("[syncpay-subscribe] SyncPay recusou", spRes.status, JSON.stringify(spData));
      // fallback: devolve URL do checkout hospedado se existir
      if (plan.checkout_url) {
        const qs = new URLSearchParams({
          name: payload.name, email: payload.email, cpf: payload.cpf, phone: payload.phone,
          ...(customer_id ? { customer_id: String(customer_id) } : {}),
        }).toString();
        return ok({
          fallback: true,
          checkout_url: `${plan.checkout_url}${plan.checkout_url.includes("?") ? "&" : "?"}${qs}`,
          error: spData?.message || `SyncPay ${spRes.status}`,
        });
      }
      return err(spData?.message || `SyncPay ${spRes.status}`, spRes.status, spData);
    }

    const sub = spData.data || spData.subscription || spData;
    const subId = sub.id || sub.token || sub.subscription_id;
    const charge = sub.charge || sub.first_charge || spData.charge || {};
    const qrText = charge.qr_code || charge.qrcode || charge.pix_code || sub.qr_code || sub.pix_code;
    const qrBase64 = charge.qr_code_base64 || charge.qrcode_base64 || sub.qr_code_base64;
    const authorizationUrl = sub.authorization_url || charge.authorization_url;

    // Registra assinante local
    if (subId) {
      await supabase.from("syncpay_subscriptions").upsert({
        syncpay_subscription_id: String(subId),
        syncpay_plan_id: planToken,
        customer_id: customer_id ? Number(customer_id) : null,
        customer_name: payload.name,
        customer_email: payload.email,
        customer_cpf: payload.cpf,
        customer_phone: payload.phone,
        billing_method: plan.billing_method,
        status: "pending",
        metadata: sub,
      }, { onConflict: "syncpay_subscription_id" });
    }

    return ok({
      subscription_id: subId,
      qr_code_text: qrText || null,
      qr_code_base64: qrBase64 || null,
      authorization_url: authorizationUrl || null,
      amount: Number(plan.amount || 0),
      raw: sub,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[syncpay-subscribe]", message);
    return err(message, 500);
  }
});
