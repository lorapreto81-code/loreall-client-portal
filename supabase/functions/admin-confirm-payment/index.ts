import { createClient } from "npm:@supabase/supabase-js@2";
import { isAdminPassword } from "../_shared/auth.ts";
import { securityHeadersFor, jsonResponse as json } from "../_shared/security.ts";

const TG_BASE = "https://topgestor.me/api/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: securityHeadersFor(req) });

  try {
    const pwd = req.headers.get("x-admin-password");
    if (!isAdminPassword(pwd)) return json({ error: "Unauthorized" }, 401, {}, req);

    const body = await req.json().catch(() => ({}));
    const { payment_id } = body;

    if (!payment_id) return json({ error: "payment_id required" }, 400, {}, req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Localizar o pagamento
    const { data: payment, error: pErr } = await supabase
      .from("payments")
      .select("*")
      .eq("id", payment_id)
      .maybeSingle();

    if (pErr || !payment) return json({ error: "Pagamento não encontrado" }, 404, {}, req);
    
    // Se já foi renovado, não faz nada (evita duplicidade manual)
    if (payment.renewed_at) return json({ ok: true, message: "Já renovado anteriormente", renewed_at: payment.renewed_at }, 200, {}, req);

    const tgToken = Deno.env.get("TOPGESTOR_API_TOKEN");
    if (!tgToken) return json({ error: "TOPGESTOR_API_TOKEN não configurado" }, 500, {}, req);

    // 2. Chamar renovação no TopGestor
    // RENEWAL_SUCCESS_MESSAGE_ID = 44282 (definido no syncpay-webhook)
    const tgRes = await fetch(`${TG_BASE}/customers/${payment.customer_id}/renew`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tgToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ 
        plan_id: payment.plan_id, 
        message_id: 44282, 
        send_whatsapp: true 
      }),
    });

    const rr = await tgRes.json().catch(() => ({}));

    // 3. Atualizar status do pagamento
    const { error: updErr } = await supabase
      .from("payments")
      .update({
        fastdepix_status: "paid",
        paid_at: payment.paid_at || new Date().toISOString(),
        renewed_at: tgRes.ok ? new Date().toISOString() : null,
        renewal_response: rr,
      })
      .eq("id", payment_id);

    if (updErr) throw updErr;

    if (!tgRes.ok) {
      return json({ 
        error: "TopGestor recusou a renovação", 
        details: rr,
        status: tgRes.status 
      }, 400, {}, req);
    }

    return json({ 
      ok: true, 
      message: "Pagamento confirmado e renovação processada no TopGestor",
      renewal_response: rr 
    }, 200, {}, req);

  } catch (err) {
    console.error("[admin-confirm-payment] error", err);
    return json({ error: err instanceof Error ? err.message : "Erro interno" }, 500, {}, req);
  }
});
