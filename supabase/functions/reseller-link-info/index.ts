import { createClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse as json, securityHeadersFor } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: securityHeadersFor(req) });
  try {
    const url = new URL(req.url);
    const slug = (url.searchParams.get("slug") || "").trim().toLowerCase();
    if (!slug) return json({ error: "slug required" }, 400, {}, req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase
      .from("reseller_links")
      .select("id, slug, display_name, credits, amount, price_per_credit, min_credits, max_credits, is_active")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    
    if (error || !data) return json({ error: "not_found" }, 404, {}, req);
    return json(data, 200, {}, req);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json({ error: message }, 500, {}, req);
  }
});
