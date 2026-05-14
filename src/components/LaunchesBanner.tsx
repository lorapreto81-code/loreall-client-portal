import { useState, useEffect, useCallback } from "react";
import { useTmdbTrending, tmdbBackdrop, type TmdbItem } from "@/hooks/useTmdbTrending";

const INTERVAL_MS = 5000;

const LaunchesBanner = () => {
  const { data, isLoading, isError } = useTmdbTrending();
  const items = data || [];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      setIdx((prev) => (prev + 1) % items.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [items.length]);

  const goTo = useCallback((i: number) => setIdx(i), []);

  if (isLoading) {
    return (
      <div className="card-elevated overflow-hidden" style={{ aspectRatio: "16/9" }}>
        <div className="skeleton-bar w-full h-full" />
      </div>
    );
  }

  if (isError || items.length === 0) return null;

  const item = items[idx];
  const bg = tmdbBackdrop(item.backdrop_path, "w1280");

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ aspectRatio: "16/9" }}>
      {bg && (
        <img
          src={bg}
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      )}

      {/* Gradient overlay for text readability */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0) 65%)",
        }}
      />

      {/* Lançamento badge */}
      <span
        className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
        style={{
          backgroundColor: "#16a34a",
          color: "#ffffff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        Lançamento
      </span>

      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="text-white text-lg font-bold drop-shadow-md" style={{ textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}>
          {item.title}
        </h3>
      </div>

      {/* Dots */}
      {items.length > 1 && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="rounded-full transition-all"
              style={{
                width: i === idx ? 18 : 6,
                height: 6,
                backgroundColor: i === idx ? "#ffffff" : "rgba(255,255,255,0.4)",
                border: "none",
                cursor: "pointer",
              }}
              aria-label={`Ir para slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LaunchesBanner;
