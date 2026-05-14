import { useEffect, useState } from "react";
import { useTmdbTrending, tmdbBackdrop, type TmdbItem } from "@/hooks/useTmdbTrending";

interface LaunchesBannerProps {
  onItemClick?: (item: TmdbItem) => void;
  intervalMs?: number;
}

const LaunchesBanner = ({ onItemClick, intervalMs = 6000 }: LaunchesBannerProps) => {
  const { data, isLoading, isError } = useTmdbTrending();
  const [index, setIndex] = useState(0);

  const items = data || [];
  const total = items.length;

  useEffect(() => {
    if (total < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % total), intervalMs);
    return () => clearInterval(t);
  }, [total, intervalMs]);

  if (isLoading) {
    return (
      <div className="card-elevated overflow-hidden" style={{ aspectRatio: "16/9" }}>
        <div className="skeleton-bar w-full h-full" />
      </div>
    );
  }

  if (isError || total === 0) return null;

  const item = items[index];
  const bg = tmdbBackdrop(item.backdrop_path, "w1280");

  const handleClick = () => {
    if (onItemClick) return onItemClick(item);
    window.open(`https://www.themoviedb.org/${item.media_type}/${item.id}`, "_blank", "noopener,noreferrer");
  };

  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIndex((i) => (i - 1 + total) % total); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setIndex((i) => (i + 1) % total); };

  return (
    <div
      onClick={handleClick}
      className="relative overflow-hidden rounded-2xl cursor-pointer group"
      style={{ aspectRatio: "16/9" }}
    >
      {bg && (
        <img
          src={bg}
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          loading="lazy"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/90">
            {item.media_type === "tv" ? "Série" : "Filme"}
          </span>
          {item.vote_average > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {item.vote_average.toFixed(1)}
            </span>
          )}
        </div>
        <h3 className="text-lg font-bold leading-tight line-clamp-1">{item.title}</h3>
        <p className="text-xs text-white/80 line-clamp-2 mt-1">{item.overview}</p>

        {total > 1 && (
          <div className="flex items-center gap-1 mt-3">
            {items.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/40"}`}
              />
            ))}
          </div>
        )}
      </div>

      {total > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={next}
            aria-label="Próximo"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
};

export default LaunchesBanner;
