import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getConfig(supabase: ReturnType<typeof createClient>, key: string): Promise<string | null> {
  const { data } = await supabase.from("system_config").select("config_value").eq("config_key", key).maybeSingle();
  return data?.config_value ?? null;
}

export async function processRecharge(
  supabase: ReturnType<typeof createClient>,
  purchaseId: string,
): Promise<{ ok: boolean; alreadyDone?: boolean; error?: string; status?: number; data?: unknown }> {
  const { data: purchase, error: pErr } = await supabase
    .from("reseller_credit_purchases")
    .select("*")
    .eq("id", purchaseId)
    .maybeSingle();

  if (pErr || !purchase) return { ok: false, error: pErr?.message || "Compra não encontrada" };
  if (purchase.recharge_status === "recharged") return { ok: true, alreadyDone: true };
  if (purchase.status !== "paid") return { ok: false, error: `Pagamento não confirmado (status=${purchase.status})` };

  const baseUrl = await getConfig(supabase, "warez_api_url");
  const token = await getConfig(supabase, "warez_api_token");
  const adminUserId = await getConfig(supabase, "warez_admin_user_id");
  if (!baseUrl || !token || token === "COLE_SEU_TOKEN_AQUI") {
    const msg = "WAREZ API não configurada (warez_api_url / warez_api_token)";
    await supabase
      .from("reseller_credit_purchases")
      .update({ recharge_status: "failed", error_message: msg })
      .eq("id", purchaseId);
    return { ok: false, error: msg };
  }

  // ---- Pré-checagem: saldo do painel admin ----
  if (adminUserId && /^\d+$/.test(String(adminUserId).trim())) {
    const balanceUrl = `${baseUrl.replace(/\/+$/, "")}/users/${String(adminUserId).trim()}`;
    const tBal = Date.now();
    let balanceStatus = 0;
    let balanceText = "";
    let balanceErr: string | null = null;
    let availableCredits: number | null = null;
    try {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), 15000);
      const r = await fetch(balanceUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(to);
      balanceStatus = r.status;
      balanceText = await r.text();
      if (r.ok) {
        try {
          const j = JSON.parse(balanceText);
          const c = j?.credits ?? j?.data?.credits ?? j?.user?.credits;
          if (typeof c === "number") availableCredits = c;
          else if (typeof c === "string" && /^\d+$/.test(c)) availableCredits = Number(c);
        } catch { /* ignore */ }
      } else {
        balanceErr = `HTTP ${r.status}`;
      }
    } catch (e) {
      balanceErr = e instanceof Error ? e.message : "erro";
    }

    await supabase.from("warez_api_logs").insert({
      endpoint: balanceUrl,
      method: "GET",
      request_body: {},
      response_status: balanceStatus,
      response_body: balanceText.slice(0, 2000),
      duration_ms: Date.now() - tBal,
      error: balanceErr,
      related_payment_id: purchaseId,
    });

    if (availableCredits !== null && availableCredits < purchase.package_credits) {
      const msg = `Saldo insuficiente no painel: ${availableCredits} disponíveis, ${purchase.package_credits} necessários. Aguardando recarga do painel.`;
      await supabase
        .from("reseller_credit_purchases")
        .update({ recharge_status: "awaiting_credits", error_message: msg })
        .eq("id", purchaseId);
      return { ok: false, error: msg };
    }
  }

  // Lock: marca processing antes de chamar, evita double-charge
  const { data: locked } = await supabase
    .from("reseller_credit_purchases")
    .update({ recharge_status: "processing" })
    .eq("id", purchaseId)
    .neq("recharge_status", "recharged")
    .select()
    .maybeSingle();

  if (!locked) return { ok: true, alreadyDone: true };

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/users/credits/${purchase.warez_user_id}`;
  const reqBody = {
    credits: purchase.package_credits,
    notes: `Recarga compra #${String(purchase.id).slice(0, 8)}`,
  };
  const t0 = Date.now();
  let status = 0;
  let respText = "";
  let respJson: unknown = null;
  let errorMsg: string | null = null;

  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 30000);
    const r = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(reqBody),
      signal: controller.signal,
    });
    clearTimeout(to);
    status = r.status;
    respText = await r.text();
    try {
      respJson = JSON.parse(respText);
    } catch {
      respJson = { raw: respText };
    }
    if (!r.ok) errorMsg = `WAREZ HTTP ${r.status}: ${respText.slice(0, 300)}`;
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Erro desconhecido";
  }

  const duration = Date.now() - t0;

  await supabase.from("warez_api_logs").insert({
    endpoint,
    method: "PATCH",
    request_body: reqBody,
    response_status: status,
    response_body: respText.slice(0, 5000),
    duration_ms: duration,
    error: errorMsg,
    related_payment_id: purchaseId,
  });

  if (errorMsg) {
    await supabase
      .from("reseller_credit_purchases")
      .update({
        recharge_status: "failed",
        error_message: errorMsg.slice(0, 500),
        warez_response: respJson as Record<string, unknown>,
      })
      .eq("id", purchaseId);
    return { ok: false, error: errorMsg, status, data: respJson };
  }

  await supabase
    .from("reseller_credit_purchases")
    .update({
      recharge_status: "recharged",
      recharged_at: new Date().toISOString(),
      warez_response: respJson as Record<string, unknown>,
      error_message: null,
    })
    .eq("id", purchaseId);

  return { ok: true, status, data: respJson };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const purchaseId = String(body.purchase_id || "").trim();
    if (!purchaseId) {
      return new Response(JSON.stringify({ error: "purchase_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const result = await processRecharge(supabase, purchaseId);
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[reseller-process-recharge] error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
