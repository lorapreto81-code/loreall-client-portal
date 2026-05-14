import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TmdbItem {
  id: number;
  media_type: "movie" | "tv";
  title: string;
  overview: string;
  backdrop_path: string | null;
  poster_path: string | null;
  vote_average: number;
  release_date: string;
}

const IMG_BASE = "https://image.tmdb.org/t/p";
export const tmdbBackdrop = (p: string | null, size: "w780" | "w1280" | "original" = "w1280") =>
  p ? `${IMG_BASE}/${size}${p}` : null;
export const tmdbPoster = (p: string | null, size: "w342" | "w500" = "w500") =>
  p ? `${IMG_BASE}/${size}${p}` : null;

async function fetchTrending(): Promise<TmdbItem[]> {
  const { data, error } = await supabase.functions.invoke("tmdb-proxy", {
    body: null,
    method: "GET",
  } as any);

  // Fallback: invoke with query string via direct fetch since edge function uses query params
  if (error || !data) {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tmdb-proxy?action=trending&language=pt-BR`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    });
    if (!res.ok) throw new Error("Falha ao carregar lançamentos");
    const json = await res.json();
    return normalize(json.results || []);
  }
  return normalize((data as any).results || []);
}

function normalize(results: any[]): TmdbItem[] {
  return results
    .filter((r) => r.backdrop_path)
    .map((r) => ({
      id: r.id,
      media_type: (r.media_type === "tv" ? "tv" : "movie") as "movie" | "tv",
      title: r.title || r.name || "",
      overview: r.overview || "",
      backdrop_path: r.backdrop_path,
      poster_path: r.poster_path,
      vote_average: r.vote_average || 0,
      release_date: r.release_date || r.first_air_date || "",
    }))
    .slice(0, 10);
}

export function useTmdbTrending() {
  return useQuery({
    queryKey: ["tmdb-trending"],
    queryFn: fetchTrending,
    staleTime: 1000 * 60 * 60 * 6, // 6h
  });
}
