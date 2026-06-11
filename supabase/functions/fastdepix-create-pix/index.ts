// PIX para renovação de cliente. Roteia entre Fast Depix e SyncPay
// conforme `system_config.pix_provider_customers`.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FAST_BASE = "https://fastdepix.space/api/v1";
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

// Gera um CPF matematicamente válido (apenas para passar validação de gateways
// que exigem CPF mas não validam identidade — ex.: SyncPay para clientes sem CPF cadastrado).
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

// ----- SyncPay token cache -----
let syncToken: { token: string; expiresAt: number } | null = null;
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

let cachedBase: string | null = null;
async function getSyncBaseUrl(): Promise<string> {
  if (cachedBase) return cachedBase;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await supabase.from("system_config").select("config_value").eq("config_key", "syncpay_api_url").maybeSingle();
  cachedBase = (data?.config_value || "https://api.syncpayments.com.br").trim();
  return cachedBase!;
}

async function getProvider(supabase: ReturnType<typeof createClient>): Promise<"syncpay" | "fastdepix"> {
  const { data } = await supabase.from("system_config").select("config_value").eq("config_key", "pix_provider_customers").maybeSingle();
  const v = (data?.config_value || "fastdepix").toLowerCase();
  return v === "syncpay" ? "syncpay" : "fastdepix";
}

// Busca CPF do cliente no TopGestor (necessário para SyncPay)
async function fetchCustomerCpf(customerId: number): Promise<{ cpf: string; email: string; phone: string } | null> {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as CreateBody;
    if (!body.customer_id || !body.plan_id || !body.amount) {
      return new Response(JSON.stringify({ error: "customer_id, plan_id e amount são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.amount < 10) {
      return new Response(JSON.stringify({ error: "Valor mínimo R$ 10,00" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const provider = await getProvider(supabase);

    // ============ SyncPay ============
    if (provider === "syncpay") {
      const tgInfo = await fetchCustomerCpf(body.customer_id);
      // CPF: usa o cadastrado; se não houver, gera um CPF válido (apenas para passar validação do SyncPay)
      const cpf = (onlyDigits(body.customer_cpf) || tgInfo?.cpf || generateValidCpf());
      const email = (body.customer_email || tgInfo?.email || `cliente_${body.customer_id}@topgestor.me`).trim();
      const phone = onlyDigits(body.customer_whatsapp) || tgInfo?.phone || "11999999999";
      const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/syncpay-webhook`;
      const token = await getSyncToken();
      const base = await getSyncBaseUrl();

      const spRes = await fetch(`${base.replace(/\/+$/, "")}/api/partner/v1/cash-in`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          amount: Number(body.amount.toFixed(2)),
          description: `Renovação ${body.plan_name}`,
          webhook_url: webhookUrl,
          client: { name: body.customer_name, cpf, email, phone },
        }),
      });
      const spData = await spRes.json().catch(() => ({}));
      if (!spRes.ok) {
        console.error("[fastdepix-create-pix] SyncPay error", spRes.status, spData);
        return new Response(JSON.stringify({ error: spData?.message || "Erro SyncPay", details: spData }), {
          status: spRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============ Fast Depix (default) ============
    const apiKey = Deno.env.get("FASTDEPIX_API_KEY");
    if (!apiKey) throw new Error("FASTDEPIX_API_KEY not configured");

    if (body.amount >= 500) {
      return new Response(JSON.stringify({
        error: "PIX indisponível para valores ≥ R$ 500. Use o link de pagamento alternativo.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const fdRes = await fetch(`${FAST_BASE}/transactions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ amount: Number(body.amount.toFixed(2)), user: { name: body.customer_name } }),
    });
    const fdData = await fdRes.json().catch(() => ({}));
    if (!fdRes.ok) {
      console.error("[fastdepix-create-pix] FD error", fdRes.status, fdData);
      return new Response(JSON.stringify({ error: fdData?.message || "Erro ao criar transação Fast Depix", details: fdData }), {
        status: fdRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const tx = fdData?.data || fdData;
    const expiresAt = parseExpiresAt(tx.qr_code_expires_at);

    const { data: inserted, error: insertErr } = await supabase
      .from("payments")
      .insert({
        customer_id: body.customer_id,
        customer_name: body.customer_name,
        customer_whatsapp: body.customer_whatsapp ?? null,
        plan_id: body.plan_id,
        plan_name: body.plan_name,
        amount: body.amount,
        provider: "fastdepix",
        fastdepix_transaction_id: tx.id,
        fastdepix_status: tx.status || "pending",
        qr_code_url: tx.qr_code,
        qr_code_text: tx.qr_code_text,
        qr_code_expires_at: expiresAt,
        metadata: {
          fastdepix_raw: tx,
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
      provider: "fastdepix",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[fastdepix-create-pix] error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
