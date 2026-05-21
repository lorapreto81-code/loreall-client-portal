import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-password",
};

const ADMIN_PASSWORD = "@996157342Slyj";
const TG_BASE = "https://topgestor.me/api/v1";

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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

async function getConfigMap(supabase: ReturnType<typeof createClient>): Promise<Record<string, string>> {
  const { data } = await supabase.from("system_config").select("config_key, config_value");
  const map: Record<string, string> = {};
  (data || []).forEach((row: any) => { map[row.config_key] = row.config_value || ""; });
  return map;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ----- get-or-create-code -----
    if (action === "get-or-create-code") {
      const body = await req.json().catch(() => ({}));
      const customerId = Number(body.customer_id);
      const customerName: string = body.customer_name || "";
      if (!customerId) return jsonRes({ error: "customer_id required" }, 400);

      const { data: existing } = await supabase
        .from("referral_codes")
        .select("*")
        .eq("customer_id", customerId)
        .maybeSingle();

      if (existing) return jsonRes({ code: existing.code, customer_id: customerId });

      for (let i = 0; i < 5; i++) {
        const code = genCode();
        const { data: inserted, error } = await supabase
          .from("referral_codes")
          .insert({ customer_id: customerId, customer_name: customerName, code })
          .select()
          .single();
        if (!error && inserted) return jsonRes({ code: inserted.code, customer_id: customerId });
        if (error && !`${error.message}`.toLowerCase().includes("duplicate")) {
          console.error("[referrals-api] insert error", error);
          return jsonRes({ error: error.message }, 500);
        }
      }
      return jsonRes({ error: "could not generate unique code" }, 500);
    }

    // ----- lookup-code -----
    if (action === "lookup-code") {
      const code = (url.searchParams.get("code") || "").trim().toUpperCase();
      if (!code) return jsonRes({ error: "code required" }, 400);
      const { data } = await supabase
        .from("referral_codes")
        .select("customer_id, customer_name, code")
        .eq("code", code)
        .maybeSingle();
      if (!data) return jsonRes({ valid: false }, 200);
      return jsonRes({ valid: true, ...data });
    }

    // ----- list-by-referrer -----
    if (action === "list-by-referrer") {
      const customerId = Number(url.searchParams.get("customer_id"));
      if (!customerId) return jsonRes({ error: "customer_id required" }, 400);

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

      return jsonRes({ referrals: list, credited, pending, total_days: totalDays });
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
      if (pwd !== ADMIN_PASSWORD) return jsonRes({ error: "Unauthorized" }, 401);
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
      if (pwd !== ADMIN_PASSWORD) return jsonRes({ error: "Unauthorized" }, 401);
      const body = await req.json().catch(() => ({}));
      const entries: Record<string, string> = body.entries || {};
      const allowed = ["trial_enabled", "trial_product_id", "trial_plan_id", "trial_telas", "trial_days", "trial_support_whatsapp"];
      const rows = Object.entries(entries)
        .filter(([k]) => allowed.includes(k))
        .map(([config_key, config_value]) => ({ config_key, config_value: String(config_value ?? "") }));
      if (rows.length === 0) return jsonRes({ ok: true });
      const { error } = await supabase.from("system_config").upsert(rows);
      if (error) return jsonRes({ error: error.message }, 500);
      return jsonRes({ ok: true });
    }

    // ----- list-pending-trials (admin) -----
    if (action === "list-pending-trials") {
      const pwd = req.headers.get("x-admin-password");
      if (pwd !== ADMIN_PASSWORD) return jsonRes({ error: "Unauthorized" }, 401);
      const { data } = await supabase
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return jsonRes({ referrals: data || [] });
    }

    // ----- create-trial (public) -----
    if (action === "create-trial") {
      const body = await req.json().catch(() => ({}));
      const code = String(body.code || "").trim().toUpperCase();
      const name = String(body.name || "").trim();
      const whatsappRaw = String(body.whatsapp || "").trim();
      const whatsapp = onlyDigits(whatsappRaw);

      if (!code) return jsonRes({ error: "Código de indicação obrigatório" }, 400);
      if (name.length < 2 || name.length > 80) return jsonRes({ error: "Nome inválido" }, 400);
      if (whatsapp.length < 10 || whatsapp.length > 13) return jsonRes({ error: "WhatsApp inválido (use DDD + número)" }, 400);

      // 1) Validate referral code
      const { data: refRow } = await supabase
        .from("referral_codes")
        .select("customer_id, customer_name, code")
        .eq("code", code)
        .maybeSingle();
      if (!refRow) return jsonRes({ error: "Código de indicação não encontrado" }, 404);

      // 2) Load trial config
      const cfg = await getConfigMap(supabase);
      if (cfg.trial_enabled === "false") {
        return jsonRes({ error: "Sistema de teste grátis temporariamente desativado" }, 403);
      }
      const productId = Number(cfg.trial_product_id);
      const planId = Number(cfg.trial_plan_id);
      const telas = Number(cfg.trial_telas || 1);
      const days = Number(cfg.trial_days || 1);
      const supportWhatsapp = cfg.trial_support_whatsapp || "";
      if (!productId || !planId) {
        return jsonRes({ error: "Configuração de teste incompleta. Avise o suporte." }, 500);
      }

      const tgToken = Deno.env.get("TOPGESTOR_API_TOKEN");
      if (!tgToken) return jsonRes({ error: "TopGestor não configurado" }, 500);
      const tgHeaders = {
        Authorization: `Bearer ${tgToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      };

      // 3) Anti-abuse: check if WhatsApp already exists in TopGestor
      try {
        const searchRes = await fetch(`${TG_BASE}/customers/search/${encodeURIComponent(whatsapp)}`, { headers: tgHeaders });
        if (searchRes.ok) {
          const searchData = await searchRes.json().catch(() => ({}));
          const list = Array.isArray(searchData?.data) ? searchData.data : (Array.isArray(searchData) ? searchData : []);
          const match = list.find((c: any) => onlyDigits(c.whatsapp || c.telefone || "") === whatsapp);
          if (match) {
            return jsonRes({
              error: "Este WhatsApp já está cadastrado. Faça login ou fale com o suporte.",
              already_exists: true,
              support_whatsapp: supportWhatsapp,
            }, 409);
          }
        }
      } catch (e) {
        console.warn("[create-trial] TG search failed (continuing)", e);
      }

      // 4) Build payload
      const usuario = `t${whatsapp.slice(-6)}${genCode(3).toLowerCase()}`.slice(0, 16);
      const password = genCode(6).toLowerCase();
      const observacao = `Teste grátis via indicação. Indicado por: ${refRow.customer_name || "ID " + refRow.customer_id} (cód ${refRow.code}).`;

      const createPayload: Record<string, unknown> = {
        name,
        whatsapp,
        product_id: productId,
        plan_id: planId,
        telas,
        usuario,
        password,
        data_de_vencimento: addDaysISO(days),
        observacao,
        send_whatsapp: false,
      };

      // 5) Create in TopGestor
      const createRes = await fetch(`${TG_BASE}/customers`, {
        method: "POST",
        headers: tgHeaders,
        body: JSON.stringify(createPayload),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        console.error("[create-trial] TG create failed", createRes.status, createData);
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
      if (referredId === Number(refRow.customer_id)) {
        return jsonRes({ error: "Você não pode se indicar" }, 400);
      }

      // 6) Insert referral row (pending_payment)
      const { error: refErr } = await supabase.from("referrals").insert({
        referrer_customer_id: refRow.customer_id,
        referred_customer_id: referredId,
        referred_customer_name: name,
        referral_code: code,
        bonus_days: 30,
        status: "pending_payment",
      });
      if (refErr && !`${refErr.message}`.toLowerCase().includes("duplicate")) {
        console.error("[create-trial] referrals insert error", refErr);
      }

      return jsonRes({
        ok: true,
        customer_id: referredId,
        usuario,
        password,
        trial_days: days,
        support_whatsapp: supportWhatsapp,
        referrer_name: refRow.customer_name,
      });
    }

    return jsonRes({ error: "Invalid action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[referrals-api] error", message);
    return jsonRes({ error: message }, 500);
  }
});
