import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Standard close (X) button used by every banner/popup in the client area. */
export const BannerCloseButton = ({ onClick, className, label = "Fechar" }: { onClick: (e: React.MouseEvent) => void; className?: string; label?: string }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onClick(e); }}
    aria-label={label}
    className={cn(
      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground",
      className,
    )}
  >
    <X className="h-4 w-4" />
  </button>
);
