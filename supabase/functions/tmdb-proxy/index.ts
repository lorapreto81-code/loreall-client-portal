import { corsHeadersFor } from "../_shared/security.ts";

const corsHeaders = corsHeadersFor();

const API_BASE = "https://api.themoviedb.org/3";

function getKey(): string {
  const key = Deno.env.get("TMDB_API_KEY")?.trim();
  if (!key) throw new Error("TMDB_API_KEY not configured");
  return key;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const cacheKey = `${ip}-${minute}`;

  // Simple in-memory rate limit for the proxy (approximate)
  if (!(globalThis as any).tmdbRateLimit) (globalThis as any).tmdbRateLimit = new Map();
  const count = ((globalThis as any).tmdbRateLimit.get(cacheKey) || 0) + 1;
  (globalThis as any).tmdbRateLimit.set(cacheKey, count);
  
  if (count > 30) {
    return new Response(JSON.stringify({ error: "Too many requests" }), { 
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
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

    const isBearer = key.startsWith("eyJ") || (key.includes(".") && key.length > 60); // v4 read access token (JWT)
    const headers: Record<string, string> = { Accept: "application/json" };
    let finalUrl = `${API_BASE}${path}`;
    if (isBearer) {
      headers["Authorization"] = `Bearer ${key}`;
    } else {
      const sep = path.includes("?") ? "&" : "?";
      finalUrl = `${API_BASE}${path}${sep}api_key=${encodeURIComponent(key)}`;
    }

    const apiRes = await fetch(finalUrl, { headers });
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
