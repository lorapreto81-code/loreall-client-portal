import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWhatsappText } from "../_shared/uazapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getConfig(supabase: ReturnType<typeof createClient>, key: string): Promise<string | null> {
  const { data } = await supabase.from("system_config").select("config_value").eq("config_key", key).maybeSingle();
  return data?.config_value ?? null;
}

function slugify(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function getUniqueSlug(supabase: ReturnType<typeof createClient>, base: string): Promise<string> {
  let candidate = base || "revenda";
  let n = 1;
  while (true) {
    const { data } = await supabase.from("reseller_links").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

function creditPrice(credits: number): number {
  if (credits >= 1000) return 5.50;
  if (credits >= 500) return 6.00;
  if (credits >= 100) return 7.00;
  if (credits >= 50) return 8.00;
  if (credits >= 30) return 10.00;
  return 11.00;
}

function formatWhatsapp(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return `+${d}`;
  return `+55${d}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { signup_id } = await req.json().catch(() => ({}));
    if (!signup_id) {
      return new Response(JSON.stringify({ ok: false, error: "signup_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signup, error: sErr } = await supabase
      .from("reseller_signups")
      .select("*")
      .eq("id", signup_id)
      .maybeSingle();

    if (sErr || !signup) {
      return new Response(JSON.stringify({ ok: false, error: "Cadastro não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (signup.status === "completed") {
      return new Response(JSON.stringify({ ok: true, alreadyDone: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = await getConfig(supabase, "warez_api_url");
    const token = await getConfig(supabase, "warez_api_token");
    if (!baseUrl || !token) {
      await supabase.from("reseller_signups").update({ status: "failed" }).eq("id", signup_id);
      return new Response(JSON.stringify({ ok: false, error: "WAREZ API não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const whatsappFormatted = formatWhatsapp(signup.whatsapp);
    const createEndpoint = `${baseUrl.replace(/\/+$/, "")}/users`;
    const createBody = {
      username: signup.desired_username,
      password: signup.desired_password,
      is_master: 0,
      credits: String(signup.credits),
      country: "Brasil",
      language: "pt",
      email: signup.email,
      whatsapp: whatsappFormatted,
      notes: `Criado automaticamente via cadastro de revenda em ${new Date().toISOString()}`,
    };

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 20000);
    let warezRes: Response;
    let warezData: any;
    try {
      warezRes = await fetch(createEndpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(createBody),
        signal: controller.signal,
      });
      warezData = await warezRes.json().catch(() => ({}));
    } catch (e) {
      clearTimeout(to);
      const msg = e instanceof Error ? e.message : "Erro de rede";
      await supabase.from("reseller_signups").update({ status: "failed" }).eq("id", signup_id);
      console.error("[reseller-signup-complete] WAREZ create falhou (rede)", msg);
      return new Response(JSON.stringify({ ok: false, error: msg }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    clearTimeout(to);

    await supabase.from("warez_api_logs").insert({
      endpoint: createEndpoint,
      method: "POST",
      request_body: createBody,
      response_status: warezRes.status,
      response_body: warezData,
      context: "reseller-signup-complete",
      reference_id: signup_id,
    }).select().maybeSingle().catch(() => {});

    if (!warezRes.ok) {
      await supabase.from("reseller_signups").update({ status: "failed" }).eq("id", signup_id);
      console.error("[reseller-signup-complete] WAREZ recusou", warezRes.status, warezData);
      return new Response(JSON.stringify({ ok: false, error: warezData?.message || `WAREZ ${warezRes.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const warezUserId = String(warezData.id);
    const baseSlug = slugify(signup.name);
    const slug = await getUniqueSlug(supabase, baseSlug);
    const pricePerCredit = creditPrice(signup.credits);

    const { data: link, error: linkErr } = await supabase
      .from("reseller_links")
      .insert({
        slug,
        display_name: signup.name,
        warez_username: signup.desired_username,
        warez_user_id: warezUserId,
        credits: signup.credits,
        amount: signup.amount,
        price_per_credit: pricePerCredit,
        min_credits: 10,
        is_active: true,
        whatsapp: signup.whatsapp,
        email: signup.email,
        notes: "Criado automaticamente via cadastro de revenda",
      })
      .select()
      .single();

    if (linkErr || !link) {
      console.error("[reseller-signup-complete] falha ao criar reseller_links", linkErr);
      await supabase.from("reseller_signups").update({ status: "completed_no_link", warez_user_id: warezUserId }).eq("id", signup_id);
      return new Response(JSON.stringify({ ok: false, error: "Revenda criada no Warez mas falhou ao salvar localmente. Verificar manualmente." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("reseller_signups").update({
      status: "completed",
      warez_user_id: warezUserId,
      reseller_link_id: link.id,
      completed_at: new Date().toISOString(),
    }).eq("id", signup_id);

    try {
      const msg = [
        `🎉 *Sua revenda foi criada, ${signup.name.split(" ")[0]}!*`,
        "",
        `📊 Painel de administração: https://wwpanel.link`,
        `👤 Usuário: *${signup.desired_username}*`,
        `🔑 Senha: *${signup.desired_password}*`,
        `💳 Créditos disponíveis: *${signup.credits}*`,
        "",
        `🔗 Seu link de recarga (pra vender e recarregar depois):`,
        `https://cliente.loreallplay.com/revendedor`,
        "",
        `Qualquer dúvida, é só chamar por aqui!`,
      ].join("\n");
      await sendWhatsappText(signup.whatsapp, msg);
    } catch (e) {
      console.error("[reseller-signup-complete] whatsapp notify failed", e);
    }

    return new Response(JSON.stringify({ ok: true, warez_user_id: warezUserId, slug }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[reseller-signup-complete]", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
