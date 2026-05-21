const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const BASE = "https://topgestor.me/api/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const token = Deno.env.get("TOPGESTOR_API_TOKEN")!;
  const body = await req.json().catch(() => ({}));
  const { path, method = "GET", payload } = body as { path: string; method?: string; payload?: unknown };
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const text = await res.text();
  return new Response(JSON.stringify({ status: res.status, body: text.slice(0, 2000) }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
