import { corsHeaders } from '@supabase/supabase-js/cors'

const API_BASE = "https://topgestor.me/api/v1";

async function getToken(): string {
  const token = Deno.env.get("TOPGESTOR_API_TOKEN");
  if (!token) throw new Error("TOPGESTOR_API_TOKEN not configured");
  return token;
}

function apiHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function proxyResponse(res: Response): Promise<Response> {
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = await getToken();
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    let apiRes: Response;

    switch (action) {
      case "search-customer": {
        const query = url.searchParams.get("query");
        if (!query) return new Response(JSON.stringify({ error: "query required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        apiRes = await fetch(`${API_BASE}/customers/search/${encodeURIComponent(query)}`, { headers: apiHeaders(token) });
        break;
      }

      case "get-customer": {
        const id = url.searchParams.get("id");
        if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        apiRes = await fetch(`${API_BASE}/customers/${id}`, { headers: apiHeaders(token) });
        break;
      }

      case "get-invoices": {
        const id = url.searchParams.get("id");
        const perPage = url.searchParams.get("per_page") || "10";
        if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        apiRes = await fetch(`${API_BASE}/customers/${id}/invoices?per_page=${perPage}`, { headers: apiHeaders(token) });
        break;
      }

      case "generate-payment-link": {
        const id = url.searchParams.get("id");
        if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        apiRes = await fetch(`${API_BASE}/customers/${id}/payment-link`, {
          method: "POST",
          headers: apiHeaders(token),
          body: JSON.stringify({}),
        });
        break;
      }

      case "get-plans": {
        apiRes = await fetch(`${API_BASE}/plans`, { headers: apiHeaders(token) });
        break;
      }

      case "update-customer": {
        const id = url.searchParams.get("id");
        if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        apiRes = await fetch(`${API_BASE}/customers/${id}`, {
          method: "PUT",
          headers: apiHeaders(token),
          body: JSON.stringify(body),
        });
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return proxyResponse(apiRes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("topgestor-proxy error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
