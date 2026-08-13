// PIX para renovação de cliente — apenas SyncPay.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createPixSchema } from "../_shared/validation.ts";
import { jsonResponse as json, securityHeadersFor, checkRateLimit } from "../_shared/security.ts";

const TG_BASE = "https://topgestor.me/api/v1";


interface CreateBody {
  customer_id: number;
  customer_name: string;
  customer_whatsapp?: string;
  customer_cpf?: string;
  customer_email?: string;
  plan_id: number;
  plan_name: string;
  amount: number;
  referral_code?: string;
}

function parseExpiresAt(raw: string | undefined | null): string {
  if (!raw) return new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const hasTz = /(?:Z|[+-]\d{2}:\d{2})\s*$/.test(raw);
  try {
    return hasTz ? new Date(raw).toISOString() : new Date(raw.trim().replace(" ", "T") + "-03:00").toISOString();
  } catch {
    return new Date(Date.now() + 15 * 60 * 1000).toISOString();
  }
}

function onlyDigits(s: string | undefined | null): string {
  return String(s || "").replace(/\D+/g, "");
}

function normalizePhone(raw: string | undefined | null): string {
  let d = onlyDigits(raw);
  if (!d) return "11999999999";
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  if (d.length >= 10 && d.length <= 11) return d;
  if (d.length === 9) return "11" + d;
  return "11999999999";
}

// CPF matematicamente válido — apenas para satisfazer validação do SyncPay
// quando o cliente não tem CPF cadastrado.
function generateValidCpf(): string {
  const n: number[] = [];
  for (let i = 0; i < 9; i++) n.push(Math.floor(Math.random() * 10));
  const calc = (arr: number[]) => {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i] * (arr.length + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  n.push(calc(n));
  n.push(calc(n));
  return n.join("");
}

let syncToken: { token: string; expiresAt: number } | null = null;
let cachedBase: string | null = null;

async function getSyncBaseUrl(): Promise<string> {
  if (cachedBase) return cachedBase;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await supabase.from("system_config").select("config_value").eq("config_key", "syncpay_api_url").maybeSingle();
  cachedBase = (data?.config_value || "https://api.syncpayments.com.br").trim();
  return cachedBase!;
}

async function getSyncToken(): Promise<string> {
  if (syncToken && syncToken.expiresAt > Date.now() + 60_000) return syncToken.token;
  const clientId = Deno.env.get("SYNCPAY_CLIENT_ID");
  const clientSecret = Deno.env.get("SYNCPAY_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("SyncPay credenciais não configuradas");
  const base = (await getSyncBaseUrl()).replace(/\/+$/, "");
  const r = await fetch(`${base}/api/partner/v1/auth-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) throw new Error(`SyncPay auth falhou: ${r.status} ${JSON.stringify(data)}`);
  syncToken = { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in || 3600) - 60) * 1000 };
  return syncToken.token;
}

async function fetchCustomerInfo(customerId: number): Promise<{ cpf: string; email: string; phone: string } | null> {
  const tgToken = Deno.env.get("TOPGESTOR_API_TOKEN");
  if (!tgToken) return null;
  try {
    const r = await fetch(`${TG_BASE}/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${tgToken}`, Accept: "application/json" },
    });
    const d = await r.json().catch(() => ({}));
    const c = d?.data || d;
    return {
      cpf: onlyDigits(c?.cpf || c?.documento || c?.document),
      email: String(c?.email || "").trim(),
      phone: onlyDigits(c?.whatsapp || c?.telefone || c?.phone),
    };
  } catch { return null; }
}

async function fetchPlanPrice(planId: number): Promise<number | null> {
  const tgToken = Deno.env.get("TOPGESTOR_API_TOKEN");
  if (!tgToken) return null;
  try {
    const r = await fetch(`${TG_BASE}/plans?per_page=200&status=ativo`, {
      headers: { Authorization: `Bearer ${tgToken}`, Accept: "application/json" },
    });
    const d = await r.json().catch(() => ({}));
    const plans = Array.isArray(d) ? d : (d?.data || d?.plans || d?.list || []);
    const plan = plans.find((p: any) => Number(p.id) === Number(planId));
    if (!plan) return null;
    const v = plan.plan_value ?? plan.value;
    return typeof v === "string" ? parseFloat(v) : Number(v || 0);
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: securityHeadersFor(req) });

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parse = createPixSchema.safeParse(rawBody);
    if (!parse.success) {
      return json({ error: "Dados inválidos.", details: parse.error.format() }, 400, {}, req);
    }
    
    const body = parse.data;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const allowed = await checkRateLimit(supabase, ip, "create-pix", 8, 15);
    if (!allowed) return json({ error: "Muitas tentativas. Aguarde alguns minutos." }, 429, {}, req);

    const tgInfo = await fetchCustomerInfo(body.customer_id);
    if (!tgInfo) {
      console.error("[SECURITY] create-pix: customer_id inexistente no TopGestor", body.customer_id);
      return json({ error: "Cliente não encontrado." }, 404, {}, req);
    }

    const realAmount = await fetchPlanPrice(body.plan_id);
    if (realAmount == null || realAmount <= 0) {
      console.error("[SECURITY] create-pix: plano não encontrado", body.plan_id);
      return json({ error: "Plano não encontrado." }, 404, {}, req);
    }
    if (Math.abs(realAmount - Number(body.amount)) > 0.01) {
      console.error("[SECURITY] create-pix: valor divergente do plano real", {
        customer_id: body.customer_id, plan_id: body.plan_id, sent: body.amount, real: realAmount,
      });
      return json({ error: "Valor não corresponde ao plano." }, 422, {}, req);
    }

    // Reaproveita um Pix já pendente e ainda válido pro mesmo cliente + mesmo plano,
    // em vez de gerar um novo a cada clique.
    const { data: existingPending } = await supabase
      .from("payments")
      .select("id, qr_code_url, qr_code_text, qr_code_expires_at, amount")
      .eq("customer_id", body.customer_id)
      .eq("plan_id", body.plan_id)
      .eq("fastdepix_status", "pending")
      .gt("qr_code_expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPending) {
      return json({
        payment_id: existingPending.id,
        qr_code_url: existingPending.qr_code_url,
        qr_code_text: existingPending.qr_code_text,
        expires_at: existingPending.qr_code_expires_at,
        amount: existingPending.amount,
        provider: "syncpay",
        reused: true,
      }, 200, {}, req);
    }

    const cpf = onlyDigits(body.customer_cpf) || tgInfo?.cpf || generateValidCpf();
    const email = (body.customer_email || tgInfo?.email || `cliente_${body.customer_id}@topgestor.me`).trim();
    const phone = normalizePhone(body.customer_whatsapp || tgInfo?.phone);
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/syncpay-webhook`;
    const token = await getSyncToken();
    const base = (await getSyncBaseUrl()).replace(/\/+$/, "");

    const spRes = await fetch(`${base}/api/partner/v1/cash-in`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount: Number(realAmount.toFixed(2)),
        description: `Renovação ${body.plan_name}`,
        webhook_url: webhookUrl,
        client: { name: body.customer_name, cpf, email, phone },
      }),
    });
    const spData = await spRes.json().catch(() => ({}));
    if (!spRes.ok) {
      console.error("[create-pix] SyncPay error", spRes.status, spData);
      return new Response(JSON.stringify({ error: spData?.message || "Erro SyncPay", details: spData }), {
        status: spRes.status, headers: { ...securityHeadersFor(req), "Content-Type": "application/json" },
      });
    }
    const tx = spData?.data || spData;
    const txId = tx.id || tx.identifier || tx.reference_id;
    const qrText = tx.pix_code || tx.qr_code_text || tx.qr_code || tx.copyPaste || "";
    const qrUrl = tx.qr_code_url || tx.qr_code_image || tx.qrcode || null;
    const expiresAt = parseExpiresAt(tx.expires_at || tx.qr_code_expires_at);

    const { data: inserted, error: insertErr } = await supabase
      .from("payments")
      .insert({
        customer_id: body.customer_id,
        customer_name: body.customer_name,
        customer_whatsapp: body.customer_whatsapp ?? null,
        plan_id: body.plan_id,
        plan_name: body.plan_name,
        amount: body.amount,
        provider: "syncpay",
        provider_transaction_id: String(txId),
        fastdepix_status: "pending",
        qr_code_url: qrUrl,
        qr_code_text: qrText,
        qr_code_expires_at: expiresAt,
        metadata: {
          syncpay_raw: tx,
          referral_code: body.referral_code ? String(body.referral_code).trim().toUpperCase() : null,
        },
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({
      payment_id: inserted.id,
      qr_code_url: inserted.qr_code_url,
      qr_code_text: inserted.qr_code_text,
      expires_at: inserted.qr_code_expires_at,
      amount: inserted.amount,
      provider: "syncpay",
    }), { status: 200, headers: { ...securityHeadersFor(req), "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[create-pix] error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...securityHeadersFor(req), "Content-Type": "application/json" },
    });
  }
});
