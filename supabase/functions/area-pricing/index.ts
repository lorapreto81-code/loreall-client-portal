import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/security.ts";

function jsonRes(data: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersFor(req) });

  try {
    const url = new URL(req.url);
    const servidor = String(url.searchParams.get("servidor") || "").trim().toLowerCase();
    const telas = parseInt(url.searchParams.get("telas") || "0", 10);

    if (!servidor || !telas || telas < 1) {
      return jsonRes({ plans: [] }, 200, req);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("area_plan_mapping")
      .select("periodicidade, topgestor_plan_id, display_name, base_amount")
      .eq("servidor", servidor)
      .eq("telas", telas)
      .order("base_amount", { ascending: true });

    if (error) {
      console.error("[area-pricing] query error", error);
      return jsonRes({ plans: [] }, 200, req);
    }

    const plans = (data || []).map((row: any) => ({
      periodicidade: row.periodicidade,
      topgestor_plan_id: Number(row.topgestor_plan_id),
      display_name: row.display_name,
      base_amount: Number(row.base_amount || 0),
      final_amount: Number(row.base_amount || 0),
    }));

    return jsonRes({ plans }, 200, req);
  } catch (err) {
    console.error("[area-pricing] unexpected error", err);
    return jsonRes({ plans: [] }, 200, req);
  }
});
