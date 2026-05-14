const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE = "https://api.themoviedb.org/3";

function getKey(): string {
  const key = Deno.env.get("TMDB_API_KEY");
  if (!key) throw new Error("TMDB_API_KEY not configured");
  return key;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const key = getKey();
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "trending";
    const language = url.searchParams.get("language") || "pt-BR";

    let path = "";
    switch (action) {
      case "trending":
        path = `/trending/all/day?language=${language}`;
        break;
      case "trending-movies":
        path = `/trending/movie/week?language=${language}`;
        break;
      case "trending-tv":
        path = `/trending/tv/week?language=${language}`;
        break;
      case "movie": {
        const id = url.searchParams.get("id");
        if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        path = `/movie/${id}?language=${language}`;
        break;
      }
      case "tv": {
        const id = url.searchParams.get("id");
        if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        path = `/tv/${id}?language=${language}`;
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sep = path.includes("?") ? "&" : "?";
    const apiRes = await fetch(`${API_BASE}${path}${sep}api_key=${key}`, {
      headers: { Accept: "application/json" },
    });
    const body = await apiRes.text();
    return new Response(body, {
      status: apiRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("tmdb-proxy error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
