import { CalendarDays, Monitor, Sparkles } from "lucide-react";
import { Customer } from "@/store/authStore";
import { formatDate } from "@/lib/format";
import { getStatusPill, telasLabel } from "@/utils/constants";

interface PlanCardProps {
  customer: Customer;
  days: number;
}

export const PlanCard = ({ customer, days }: PlanCardProps) => {
  const pill = getStatusPill(days);
  const points = (customer as any).pontos || (customer as any).meta?.pontos;
  
  return (
    <div className="card-elevated p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent" />

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Seu plano</p>
          <div className="flex items-center gap-2">
            <p className="text-xl font-bold text-foreground leading-tight truncate">{customer.plan?.name || "—"}</p>
            {points > 0 && (
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500">
                <Sparkles className="h-3 w-3" />
                <span className="text-[10px] font-bold">{points} pts</span>
              </div>
            )}
          </div>
        </div>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
          style={{ background: pill.bg, color: pill.color }}
        >
          {pill.label.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-3" style={{ borderTop: "1px solid hsl(var(--border))" }}>
        <div className="flex items-start gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground mb-0.5">Vence em</p>
            <p className="text-sm font-semibold text-foreground">{formatDate(customer.data_de_vencimento)}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground mb-0.5">Telas</p>
            <p className="text-sm font-semibold text-foreground">{telasLabel(customer.telas)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

