import { createClient } from "npm:@supabase/supabase-js@2";
import { getCustomerSession, isAdminPassword } from "../_shared/auth.ts";
import { sendWhatsappText } from "../_shared/uazapi.ts";

import { signWebhookPayload, corsHeadersFor } from "../_shared/security.ts";


const TG_BASE = "https://topgestor.me/api/v1";

function jsonRes(data: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json" },
  });
}

// Code generator: 6 chars uppercase, no ambiguous (0/O, 1/I)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode(len = 6): string {
  let s = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
}

function onlyDigits(s: string): string {
  return String(s || "").replace(/\D/g, "");
}

function addDaysISO(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addHoursISO(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

const SERVER_TELAS_MAP: Record<string, number[]> = {
  uniplay_p2p: [1],
  uniplay_iptv: [1, 2],
  warez: [1, 2, 3],
};
const SERVER_HORAS_MAP: Record<string, number[]> = {
  uniplay_p2p: [1, 2, 3, 6],
  uniplay_iptv: [1, 2, 3, 6],
  warez: [1, 2, 3, 4],
};

async function getConfigMap(supabase: ReturnType<typeof createClient>): Promise<Record<string, string>> {
  const { data } = await supabase.from("system_config").select("config_key, config_value");
  const map: Record<string, string> = {};
  (data || []).forEach((row: any) => { map[row.config_key] = row.config_value || ""; });
  return map;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersFor(req) });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ----- track-copy (público, fire-and-forget) -----
    if (action === "track-copy") {
      const body = await req.json().catch(() => ({}));
      const code = String(body.code || "").trim().toUpperCase();
      if (code && /^[A-Z0-9]{4,16}$/.test(code)) {
        try {
          await supabase.rpc("increment_copy_count", { p_code: code });
        } catch { /* ignore */ }
      }
      return jsonRes({ ok: true }, 200, req);
    }

    // ----- admin-referral-stats (admin) -----
    if (action === "admin-referral-stats") {
      const pwd = req.headers.get("x-admin-password");
      if (!isAdminPassword(pwd)) return jsonRes({ error: "Unauthorized" }, 401, req);

      const { count: totalCodes } = await supabase.from("referral_codes").select("*", { count: "exact", head: true });
      const { data: codesRows } = await supabase.from("referral_codes").select("copy_count");
      const totalCopies = (codesRows || []).reduce((sum: number, r: { copy_count: number | null }) => sum + (r.copy_count || 0), 0);

      const { count: totalSignups } = await supabase.from("trial_signups").select("*", { count: "exact", head: true });
      const { count: pendingSignups } = await supabase.from("trial_signups").select("*", { count: "exact", head: true }).eq("status", "pending");
      const { count: creditedBonus } = await supabase.from("referrals").select("*", { count: "exact", head: true }).eq("status", "credited");
      const { data: bonusRows } = await supabase.from("referrals").select("bonus_days").eq("status", "credited");
      const totalBonusDays = (bonusRows || []).reduce((sum: number, r: { bonus_days: number | null }) => sum + (r.bonus_days || 0), 0);

      return jsonRes({
        total_codes: totalCodes || 0,
        total_link_copies: totalCopies,
        total_signups: totalSignups || 0,
        pending_signups: pendingSignups || 0,
        bonuses_credited: creditedBonus || 0,
        total_bonus_days_given: totalBonusDays,
      }, 200, req);
    }

    // ----- get-or-create-code -----

    if (action === "get-or-create-code") {
      const body = await req.json().catch(() => ({}));
      const customerId = Number(body.customer_id);
      const customerName: string = body.customer_name || "";
      if (!customerId) return jsonRes({ error: "customer_id required" }, 400, req);

      const session = await getCustomerSession(req);
      if (!session) return jsonRes({ error: "Unauthorized" }, 401, req);
      if (session.sub !== customerId) return jsonRes({ error: "Forbidden" }, 403, req);

      const { data: existing } = await supabase
        .from("referral_codes")
        .select("*")
        .eq("customer_id", customerId)
        .maybeSingle();

      if (existing) return jsonRes({ code: existing.code, customer_id: customerId }, req);

      for (let i = 0; i < 5; i++) {
        const code = genCode();
        const { data: inserted, error } = await supabase
          .from("referral_codes")
          .insert({ customer_id: customerId, customer_name: customerName, code })
          .select()
          .single();
        if (!error && inserted) return jsonRes({ code: inserted.code, customer_id: customerId }, req);
        if (error && !`${error.message}`.toLowerCase().includes("duplicate")) {
          console.error("[referrals-api] insert error", error);
          return jsonRes({ error: error.message }, 500, req);
        }
      }
      return jsonRes({ error: "could not generate unique code" }, 500, req);
    }

    // ----- lookup-code -----
    if (action === "lookup-code") {
      const code = (url.searchParams.get("code") || "").trim().toUpperCase();
      if (!code) return jsonRes({ error: "code required" }, 400, req);
      const { data } = await supabase
        .from("referral_codes")
        .select("customer_id, customer_name, code")
        .eq("code", code)
        .maybeSingle();
      if (!data) return jsonRes({ valid: false }, 200, req);
      return jsonRes({ valid: true, ...data }, 200, req);
    }

    // ----- list-by-referrer -----
    if (action === "list-by-referrer") {
      const customerId = Number(url.searchParams.get("customer_id"));
      if (!customerId) return jsonRes({ error: "customer_id required" }, 400, req);

      const session = await getCustomerSession(req);
      if (!session) return jsonRes({ error: "Unauthorized" }, 401, req);
      if (session.sub !== customerId) return jsonRes({ error: "Forbidden" }, 403, req);

      const { data: referrals } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_customer_id", customerId)
        .order("created_at", { ascending: false });

      const list = referrals || [];
      const credited = list.filter((r) => r.status === "credited").length;
      const pending = list.filter((r) =>
        r.status === "pending_payment" || r.status === "pending_referrer_renewal"
      ).length;
      const totalDays = list
        .filter((r) => r.status === "credited")
        .reduce((acc, r) => acc + (r.bonus_days || 0), 0);

      return jsonRes({ referrals: list, credited, pending, total_days: totalDays }, 200, req);
    }

    // ----- referral-progress (customer, indicador vê o progresso de cada indicação) -----
    if (action === "referral-progress") {
      const customerId = Number(url.searchParams.get("customer_id"));
      if (!customerId) return jsonRes({ error: "customer_id required" }, 400, req);
      const session = await getCustomerSession(req);
      if (!session) return jsonRes({ error: "Unauthorized" }, 401, req);
      if (session.sub !== customerId) return jsonRes({ error: "Forbidden" }, 403, req);

      const { data: signups } = await supabase
        .from("trial_signups")
        .select("name, status, topgestor_customer_id, created_at")
        .eq("referrer_customer_id", customerId)
        .order("created_at", { ascending: false });

      const { data: referrals } = await supabase
        .from("referrals")
        .select("id, referred_customer_id, referred_customer_name, status, created_at")
        .eq("referrer_customer_id", customerId)
        .order("created_at", { ascending: false });

      const combined: Array<{ name: string; percent: number; stage: string; created_at: string }> = [];
      const usedReferralIds = new Set<string>();

      for (const s of signups || []) {
        const matched = s.topgestor_customer_id
          ? (referrals || []).find((r) => Number(r.referred_customer_id) === Number(s.topgestor_customer_id))
          : null;
        if (matched) {
          usedReferralIds.add(matched.id);
          combined.push({
            name: s.name,
            percent: matched.status === "credited" ? 100 : 90,
            stage: matched.status === "credited" ? "Bônus creditado! 🎉" : "Pagou — aguardando liberação do bônus",
            created_at: s.created_at,
          });
        } else {
          const percent = s.status === "approved" ? 60 : s.status === "rejected" ? 0 : 25;
          const stage = s.status === "approved" ? "Teste liberado, contando" : s.status === "rejected" ? "Não aprovado" : "Cadastro enviado";
          combined.push({ name: s.name, percent, stage, created_at: s.created_at });
        }
      }
      for (const r of referrals || []) {
        if (usedReferralIds.has(r.id)) continue;
        combined.push({
          name: r.referred_customer_name,
          percent: r.status === "credited" ? 100 : 90,
          stage: r.status === "credited" ? "Bônus creditado! 🎉" : "Pagou — aguardando liberação do bônus",
          created_at: r.created_at,
        });
      }
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return jsonRes({ referrals: combined }, 200, req);
    }

    // ----- get-trial-config (public — only returns non-sensitive fields) -----
    if (action === "get-trial-config-public") {
      const cfg = await getConfigMap(supabase);
      return jsonRes({
        enabled: cfg.trial_enabled !== "false",
        days: Number(cfg.trial_days || 1),
        telas: Number(cfg.trial_telas || 1),
        support_whatsapp: cfg.trial_support_whatsapp || "",
      });
    }

    // ----- get-trial-config (admin) -----
    if (action === "get-trial-config") {
      const pwd = req.headers.get("x-admin-password");
      if (!isAdminPassword(pwd)) return jsonRes({ error: "Unauthorized" }, 401, req);
      const cfg = await getConfigMap(supabase);
      return jsonRes({
        config: {
          trial_enabled: cfg.trial_enabled || "true",
          trial_product_id: cfg.trial_product_id || "",
          trial_plan_id: cfg.trial_plan_id || "",
          trial_telas: cfg.trial_telas || "1",
          trial_days: cfg.trial_days || "1",
          trial_support_whatsapp: cfg.trial_support_whatsapp || "",
        },
      });
    }

    // ----- update-trial-config (admin) -----
    if (action === "update-trial-config") {
      const pwd = req.headers.get("x-admin-password");
      if (!isAdminPassword(pwd)) return jsonRes({ error: "Unauthorized" }, 401, req);
      const body = await req.json().catch(() => ({}));
      const entries: Record<string, string> = body.entries || {};
      const allowed = ["trial_enabled", "trial_product_id", "trial_plan_id", "trial_telas", "trial_days", "trial_support_whatsapp"];
      const rows = Object.entries(entries)
        .filter(([k]) => allowed.includes(k))
        .map(([config_key, config_value]) => ({ config_key, config_value: String(config_value ?? "") }));
      if (rows.length === 0) return jsonRes({ ok: true }, 200, req);
      const { error } = await supabase.from("system_config").upsert(rows);
      if (error) return jsonRes({ error: error.message }, 500, req);
      return jsonRes({ ok: true }, 200, req);
    }

    // ----- list-pending-trials (admin) -----
    if (action === "list-pending-trials") {
      const pwd = req.headers.get("x-admin-password");
      if (!isAdminPassword(pwd)) return jsonRes({ error: "Unauthorized" }, 401, req);
      const { data } = await supabase
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return jsonRes({ referrals: data || [] }, 200, req);
    }

    // ----- create-trial (public) -----
    // NEW BEHAVIOR: enqueue in trial_signups (status=pending) instead of creating in TopGestor.
    // Admin must approve manually — credentials are created in the panel (Warez/Uniplay) first.
    if (action === "create-trial") {
      const body = await req.json().catch(() => ({}));
      const code = String(body.code || "").trim().toUpperCase();
      const name = String(body.name || "").trim();
      const whatsappRaw = String(body.whatsapp || "").trim();
      const whatsapp = onlyDigits(whatsappRaw);

      if (!code) return jsonRes({ error: "Código de indicação obrigatório" }, 400, req);
      if (name.length < 2 || name.length > 80) return jsonRes({ error: "Nome inválido" }, 400, req);
      if (whatsapp.length < 10 || whatsapp.length > 13) return jsonRes({ error: "WhatsApp inválido (use DDD + número)" }, 400, req);

      // 1) Validate referral code
      const { data: refRow } = await supabase
        .from("referral_codes")
        .select("customer_id, customer_name, code")
        .eq("code", code)
        .maybeSingle();
      if (!refRow) return jsonRes({ error: "Código de indicação não encontrado" }, 404, req);

      // 2) Load trial config
      const cfg = await getConfigMap(supabase);
      if (cfg.trial_enabled === "false") {
        return jsonRes({ error: "Sistema de teste grátis temporariamente desativado" }, 403, req);
      }
      const days = Number(cfg.trial_days || 1);
      const telas = Number(cfg.trial_telas || 1);
      const supportWhatsapp = cfg.trial_support_whatsapp || "";

      // 3) Anti-abuse: reject if WhatsApp already exists in TopGestor as active customer
      const tgToken = Deno.env.get("TOPGESTOR_API_TOKEN");
      if (tgToken) {
        try {
          const searchRes = await fetch(`${TG_BASE}/customers/search/${encodeURIComponent(whatsapp)}`, {
            headers: { Authorization: `Bearer ${tgToken}`, Accept: "application/json" },
          });
          if (searchRes.ok) {
            const searchData = await searchRes.json().catch(() => ({}));
            const list = Array.isArray(searchData?.data) ? searchData.data : (Array.isArray(searchData) ? searchData : []);
            const match = list.find((c: any) => onlyDigits(c.whatsapp || c.telefone || "") === whatsapp);
            if (match) {
              return jsonRes({
                error: "Este WhatsApp já está cadastrado. Faça login ou fale com o suporte.",
                already_exists: true,
                support_whatsapp: supportWhatsapp,
              }, 409, req);
            }
          }
        } catch (e) {
          console.warn("[create-trial] TG search failed (continuing)", e);
        }
      }

      // 4) Insert into trial_signups queue
      const { data: inserted, error: insErr } = await supabase
        .from("trial_signups")
        .insert({
          referral_code: code,
          referrer_customer_id: refRow.customer_id,
          referrer_customer_name: refRow.customer_name,
          name,
          whatsapp,
          status: "pending",
          trial_days: days,
        })
        .select()
        .single();

      if (insErr) {
        const msg = String(insErr.message || "").toLowerCase();
        if (msg.includes("duplicate") || msg.includes("unique")) {
          return jsonRes({
            error: "Este WhatsApp já tem um cadastro em análise ou aprovado. Fale com o suporte.",
            already_exists: true,
            support_whatsapp: supportWhatsapp,
          }, 409, req);
        }
        console.error("[create-trial] signup insert error", insErr);
        return jsonRes({ error: insErr.message }, 500, req);
      }

      return jsonRes({
        ok: true,
        status: "pending",
        signup_id: inserted?.id,
        trial_days: days,
        telas,
        support_whatsapp: supportWhatsapp,
        referrer_name: refRow.customer_name,
      }, 200, req);
    }

    // ----- list-signups (admin) -----
    if (action === "list-signups") {
      const pwd = req.headers.get("x-admin-password");
      if (!isAdminPassword(pwd)) return jsonRes({ error: "Unauthorized" }, 401, req);
      const status = url.searchParams.get("status"); // pending | approved | rejected | null=all
      let q = supabase.from("trial_signups").select("*").order("created_at", { ascending: false }).limit(300);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return jsonRes({ error: error.message }, 500, req);
      return jsonRes({ signups: data || [] }, 200, req);
    }

    // ----- approve-signup (admin) -----
    // Admin has ALREADY created user/password in Warez/Uniplay. Now we:
    //   1) create the customer in TopGestor with those credentials
    //   2) mark signup as approved
    //   3) create a referrals row (pending_payment) so referrer bonus is triggered on 1st PIX
    if (action === "approve-signup") {
      const pwd = req.headers.get("x-admin-password");
      if (!isAdminPassword(pwd)) return jsonRes({ error: "Unauthorized" }, 401, req);

      const body = await req.json().catch(() => ({}));
      const signupId = String(body.signup_id || "").trim();
      const usuario = String(body.usuario || "").trim();
      const password = String(body.password || "").trim();
      const planIdOverride = body.plan_id ? Number(body.plan_id) : null;
      const servidor = String(body.servidor || "").trim();
      const telasEscolhidas = Number(body.telas || 0);
      const horas = Number(body.trial_hours || 0);

      if (!signupId) return jsonRes({ error: "signup_id obrigatório" }, 400, req);
      if (usuario.length < 2 || usuario.length > 32) return jsonRes({ error: "Usuário inválido" }, 400, req);
      if (password.length < 3 || password.length > 32) return jsonRes({ error: "Senha inválida" }, 400, req);
      if (!SERVER_TELAS_MAP[servidor]) return jsonRes({ error: "Servidor inválido" }, 400, req);
      if (!SERVER_TELAS_MAP[servidor].includes(telasEscolhidas)) {
        return jsonRes({ error: `Esse servidor não oferece ${telasEscolhidas} tela(s)` }, 400, req);
      }
      if (!SERVER_HORAS_MAP[servidor].includes(horas)) {
        return jsonRes({ error: `Esse servidor não oferece teste de ${horas}h` }, 400, req);
      }

      const { data: signup, error: getErr } = await supabase
        .from("trial_signups")
        .select("*")
        .eq("id", signupId)
        .maybeSingle();
      if (getErr || !signup) return jsonRes({ error: "Cadastro não encontrado" }, 404, req);
      if (signup.status !== "pending") {
        return jsonRes({ error: `Cadastro já está ${signup.status}` }, 409, req);
      }

      const cfg = await getConfigMap(supabase);
      const productId = Number(cfg.trial_product_id);
      const planId = planIdOverride || Number(cfg.trial_plan_id);
      const telas = telasEscolhidas;
      const supportWhatsapp = cfg.trial_support_whatsapp || "";
      if (!productId || !planId) {
        return jsonRes({ error: "Configure product_id e plan_id na aba Indicação antes de aprovar" }, 500, req);
      }

      const tgToken = Deno.env.get("TOPGESTOR_API_TOKEN");
      if (!tgToken) return jsonRes({ error: "TopGestor não configurado" }, 500, req);

      const servidorLabel = { uniplay_p2p: "Uniplay P2P", uniplay_iptv: "Uniplay IPTV", warez: "Warez" }[servidor as keyof typeof SERVER_TELAS_MAP];
      const observacao = `Teste grátis via indicação. Servidor: ${servidorLabel}. Indicado por: ${signup.referrer_customer_name || "ID " + signup.referrer_customer_id} (cód ${signup.referral_code}). Aprovado manualmente.`;

      const createPayload: Record<string, unknown> = {
        name: signup.name,
        whatsapp: signup.whatsapp,
        product_id: productId,
        plan_id: planId,
        telas,
        usuario,
        password,
        data_de_vencimento: addHoursISO(horas),
        observacao,
        send_whatsapp: false,
      };

      const createRes = await fetch(`${TG_BASE}/customers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tgToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createPayload),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        console.error("[approve-signup] TG create failed", createRes.status, createData);
        return jsonRes({
          error: createData?.message || createData?.error || `Falha ao criar no TopGestor (${createRes.status})`,
          tg_response: createData,
        }, 500);
      }
      const createdCustomer = createData?.data || createData;
      const referredId = Number(createdCustomer?.id);
      if (!referredId) {
        return jsonRes({ error: "TopGestor não retornou ID do cliente", tg_response: createData }, 500);
      }

      // Block self-referral
      if (referredId === Number(signup.referrer_customer_id)) {
        return jsonRes({ error: "Auto-indicação detectada — TopGestor retornou o próprio ID do indicador" }, 400, req);
      }

      // Mark signup approved
      await supabase
        .from("trial_signups")
        .update({
          status: "approved",
          topgestor_customer_id: referredId,
          usuario,
          password,
          plan_id: planId,
          trial_hours: horas,
          approved_at: new Date().toISOString(),
          approved_by: "admin",
        })
        .eq("id", signupId);

      // WhatsApp welcome message
      try {
        const msg = [
          `🎉 *Parabéns, ${signup.name.split(" ")[0]}!*`,
          "",
          `Seu teste grátis do *Loreall Play* de ${horas}h já está liberado!`,
          "",
          `👤 Usuário: *${usuario}*`,
          `🔑 Senha: *${password}*`,
          "",
          `📲 Instalação passo a passo: https://cliente.loreallplay.com/instalacao`,
          "",
          supportWhatsapp ? `Qualquer dúvida, fala com a gente: ${supportWhatsapp}` : "Qualquer dúvida, é só chamar por aqui!",
        ].join("\n");
        await sendWhatsappText(signup.whatsapp, msg);
      } catch (e) {
        console.error("[approve-signup] whatsapp notify failed", e);
      }

      // Register referral (pending_payment) — bonus fires when referred pays 1st PIX
      const { error: refErr } = await supabase.from("referrals").insert({
        referrer_customer_id: signup.referrer_customer_id,
        referred_customer_id: referredId,
        referred_customer_name: signup.name,
        referral_code: signup.referral_code,
        bonus_days: 30,
        status: "pending_payment",
      });
      if (refErr && !`${refErr.message}`.toLowerCase().includes("duplicate")) {
        console.error("[approve-signup] referrals insert error", refErr);
      }

      return jsonRes({
        ok: true,
        customer_id: referredId,
        usuario,
        password,
        trial_hours: horas,
        support_whatsapp: supportWhatsapp,
      });
    }

    // ----- reject-signup (admin) -----
    if (action === "reject-signup") {
      const pwd = req.headers.get("x-admin-password");
      if (!isAdminPassword(pwd)) return jsonRes({ error: "Unauthorized" }, 401, req);
      const body = await req.json().catch(() => ({}));
      const signupId = String(body.signup_id || "").trim();
      const reason = String(body.reason || "").trim().slice(0, 300);
      if (!signupId) return jsonRes({ error: "signup_id obrigatório" }, 400, req);

      const { data: signup } = await supabase
        .from("trial_signups")
        .select("status")
        .eq("id", signupId)
        .maybeSingle();
      if (!signup) return jsonRes({ error: "Cadastro não encontrado" }, 404, req);
      if (signup.status !== "pending") {
        return jsonRes({ error: `Cadastro já está ${signup.status}` }, 409, req);
      }

      const { error } = await supabase
        .from("trial_signups")
        .update({
          status: "rejected",
          rejection_reason: reason || "Sem motivo informado",
          rejected_at: new Date().toISOString(),
          approved_by: "admin",
        })
        .eq("id", signupId);
      if (error) return jsonRes({ error: error.message }, 500, req);
      return jsonRes({ ok: true }, 200, req);
    }

    // ----- get-signup-status (public — used by "em análise" screen for polling) -----
    if (action === "get-signup-status") {
      const signupId = String(url.searchParams.get("signup_id") || "").trim();
      if (!signupId) return jsonRes({ error: "signup_id required" }, 400, req);
      const { data } = await supabase
        .from("trial_signups")
        .select("id, status, name, trial_days, created_at")
        .eq("id", signupId)
        .maybeSingle();
      if (!data) return jsonRes({ error: "not found" }, 404, req);
      return jsonRes(data, 200, req);
    }

    return jsonRes({ error: "Invalid action" }, 400, req);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[referrals-api] error", message);
    return jsonRes({ error: message }, 500, req);
  }
});
