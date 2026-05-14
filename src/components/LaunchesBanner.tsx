import { useTmdbTrending, tmdbBackdrop, type TmdbItem } from "@/hooks/useTmdbTrending";

interface LaunchesBannerProps {
  onItemClick?: (item: TmdbItem) => void;
  intervalMs?: number;
}

const LaunchesBanner = (_props: LaunchesBannerProps) => {
  const { data, isLoading, isError } = useTmdbTrending();

  const items = data || [];

  if (isLoading) {
    return (
      <div className="card-elevated overflow-hidden" style={{ aspectRatio: "16/9" }}>
        <div className="skeleton-bar w-full h-full" />
      </div>
    );
  }

  if (isError || items.length === 0) return null;

  const item = items[0];
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
    </div>
  );
};

export default LaunchesBanner;
