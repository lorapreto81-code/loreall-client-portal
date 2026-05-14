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

  return (
    <div
      onClick={handleClick}
      className="relative overflow-hidden rounded-2xl cursor-pointer"
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
    </div>
  );
};

export default LaunchesBanner;
