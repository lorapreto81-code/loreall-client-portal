// PIX para recarga de revendedor — apenas SyncPay.
import { createClient } from "npm:@supabase/supabase-js@2";
import { resellerCreatePixSchema } from "../_shared/validation.ts";
import { jsonResponse as json, securityHeaders, corsHeadersFor } from "../_shared/security.ts";
import { calculateTieredPrice } from "../_shared/prices.ts";

 


function parseExpiresAt(raw: string | undefined | null): string {
  if (!raw) return new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const hasTz = /(?:Z|[+-]\d{2}:\d{2})\s*$/.test(raw);
  try {
    return hasTz ? new Date(raw).toISOString() : new Date(raw.trim().replace(" ", "T") + "-03:00").toISOString();
  } catch {
    return new Date(Date.now() + 15 * 60 * 1000).toISOString();
  }
}
function normalizePhone(raw: string | undefined): string {
  if (!raw) return "";
  let d = String(raw).replace(/\D+/g, "");
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  if (d.length >= 10 && d.length <= 11) return d;
  if (d.length === 9) return "11" + d;
  return "";
}
function normalizeWhatsapp(raw: string | undefined): string {
  if (!raw) return "";
  const digits = String(raw).replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length >= 10 && digits.length <= 11) return "55" + digits;
  return digits;
}
function onlyDigits(s: string | undefined | null): string {
  return String(s || "").replace(/\D+/g, "");
}

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
async function getSyncBaseUrl(supabase: ReturnType<typeof createClient>): Promise<string> {
  if (cachedBase) return cachedBase;
  const { data } = await supabase.from("system_config").select("config_value").eq("config_key", "syncpay_api_url").maybeSingle();
  cachedBase = (data?.config_value || "https://api.syncpayments.com.br").trim();
  return cachedBase!;
}
async function getSyncToken(supabase: ReturnType<typeof createClient>): Promise<string> {
  if (syncToken && syncToken.expiresAt > Date.now() + 60_000) return syncToken.token;
  const clientId = Deno.env.get("SYNCPAY_CLIENT_ID");
  const clientSecret = Deno.env.get("SYNCPAY_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("SyncPay credenciais não configuradas");
  const base = (await getSyncBaseUrl(supabase)).replace(/\/+$/, "");
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


Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: securityHeaders });

  try {

    const rawBody = await req.json().catch(() => ({}));
    const parse = resellerCreatePixSchema.safeParse(rawBody);
    if (!parse.success) {
      return json({ error: "Dados inválidos.", details: parse.error.format() }, 400);
    }
    
    const body = parse.data;
    const slug = body.slug.trim().toLowerCase();


    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: link, error: linkErr } = await supabase
      .from("reseller_links")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (linkErr) throw linkErr;
    if (!link) {
      return new Response(JSON.stringify({ error: "Revendedor não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const whatsapp = normalizeWhatsapp(body.whatsapp);
    const finalEmail = String(body.email || "").trim().toLowerCase() || `${slug}@renovartv.app`;
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") || null;

    if (ipAddress) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("reseller_credit_purchases")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", ipAddress)
        .gte("created_at", since);
      if ((count ?? 0) > 10) {
        return new Response(JSON.stringify({ error: "Limite de tentativas excedido para o seu IP. Aguarde uma hora." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const minC = Number(link.min_credits ?? 10);
    const maxC = Number(link.max_credits ?? 30);
    const basePrice = Number(link.price_per_credit ?? link.amount / (link.credits || 1));
    const requested = Number.isFinite(Number(body.credits)) ? Math.floor(Number(body.credits)) : Number(link.credits);
    const credits = Math.max(minC, Math.min(maxC, requested));
    const price = calculateTieredPrice(credits, basePrice);
    const amount = Number((credits * price).toFixed(2));

    // Reaproveita um Pix já pendente e ainda válido para o mesmo revendedor + mesma quantidade de créditos
    const { data: existingPending } = await supabase
      .from("reseller_credit_purchases")
      .select("id, qr_code_url, qr_code_text, qr_code_expires_at, amount, package_credits, warez_username")
      .eq("reseller_link_id", link.id)
      .eq("package_credits", credits)
      .eq("status", "pending")
      .gt("qr_code_expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPending) {
      return new Response(JSON.stringify({
        success: true,
        purchase_id: existingPending.id,
        qr_code_url: existingPending.qr_code_url,
        qr_code_text: existingPending.qr_code_text,
        expires_at: existingPending.qr_code_expires_at,
        amount: existingPending.amount,
        package_credits: existingPending.package_credits,
        warez_username: existingPending.warez_username,
        provider: "syncpay",
        reused: true,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // CPF é opcional: se não informado, gera um CPF válido automaticamente
    const cpf = onlyDigits(body.cpf) || generateValidCpf();
    const phone = normalizePhone(whatsapp) || "11999999999";
    const token = await getSyncToken(supabase);
    const base = (await getSyncBaseUrl(supabase)).replace(/\/+$/, "");
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/syncpay-webhook`;

    const spRes = await fetch(`${base}/api/partner/v1/cash-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        amount,
        description: `Recarga ${credits} créditos - ${link.warez_username}`,
        webhook_url: webhookUrl,
        client: { name: link.warez_username, cpf, email: finalEmail, phone },
      }),
    });
    const spData = await spRes.json().catch(() => ({}));
    if (!spRes.ok) {
      console.error("[reseller-create-pix] SyncPay error", spRes.status, spData);
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
      .from("reseller_credit_purchases")
      .insert({
        reseller_link_id: link.id,
        warez_username: link.warez_username,
        warez_user_id: link.warez_user_id,
        whatsapp, email: finalEmail,
        package_credits: credits, amount,
        provider: "syncpay",
        provider_transaction_id: String(txId),
        qr_code_url: qrUrl,
        qr_code_text: qrText,
        qr_code_expires_at: expiresAt,
        status: "pending", recharge_status: "pending",
        ip_address: ipAddress,
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({
      success: true,
      purchase_id: inserted.id,
      qr_code_url: inserted.qr_code_url,
      qr_code_text: inserted.qr_code_text,
      expires_at: inserted.qr_code_expires_at,
      amount: inserted.amount,
      package_credits: inserted.package_credits,
      warez_username: inserted.warez_username,
      provider: "syncpay",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[reseller-create-pix] error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
