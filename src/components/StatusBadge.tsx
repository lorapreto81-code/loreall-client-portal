import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "bg-accent/15 text-accent" },
  active: { label: "Ativo", className: "bg-accent/15 text-accent" },
  vencido: { label: "Vencido", className: "bg-destructive/15 text-destructive" },
  expired: { label: "Vencido", className: "bg-destructive/15 text-destructive" },
  suspendido: { label: "Suspendido", className: "bg-warning/15 text-warning" },
  suspended: { label: "Suspendido", className: "bg-warning/15 text-warning" },
  pago: { label: "Pago", className: "bg-success/15 text-success" },
  paid: { label: "Pago", className: "bg-success/15 text-success" },
  pendente: { label: "Pendente", className: "bg-warning/15 text-warning" },
  pending: { label: "Pendente", className: "bg-warning/15 text-warning" },
  "em aberto": { label: "Em aberto", className: "bg-warning/15 text-warning" },
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const key = status?.toLowerCase() || "";
  const config = statusConfig[key] || { label: status, className: "bg-muted text-muted-foreground" };

  return (
    <span className={cn("inline-flex items-center px-3 py-1 rounded-pill text-xs font-semibold", config.className, className)}>
      {config.label}
    </span>
  );
};
