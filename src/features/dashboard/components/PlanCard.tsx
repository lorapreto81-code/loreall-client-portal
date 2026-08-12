import { CalendarDays, Monitor, Sparkles, Repeat, Clock } from "lucide-react";
import { Customer } from "@/store/authStore";
import { formatDate } from "@/lib/format";
import { getStatusPill, telasLabel } from "@/utils/constants";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PlanCardProps {
  customer: Customer;
  days: number;
}

export const PlanCard = ({ customer, days }: PlanCardProps) => {
  const pill = getStatusPill(days);
  const points = (customer as any).pontos || (customer as any).meta?.pontos;

  const subQuery = useQuery({
    queryKey: ["active-subscription", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("syncpay_subscriptions")
        .select("*")
        .eq("customer_id", customer.id)
        .in("status", ["pending_first_payment", "active", "overdue"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    staleTime: 60000,
  });

  const subscription = subQuery.data;
  const mandateActive = subscription?.mandate_status?.toUpperCase() === "ACTIVE";
  const isFullyActive = subscription?.status === "active";
  const isOverdue = subscription?.status === "overdue";

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

      {subscription && isOverdue && (
        <div className="mt-3 pt-3 flex items-center gap-2 border-t border-white/5">
          <div className="p-1.5 rounded-full bg-destructive/10">
            <Repeat className="h-3 w-3 text-destructive" />
          </div>
          <p className="text-[11px] font-medium text-destructive">Pix Automático — pagamento em atraso</p>
        </div>
      )}

      {subscription && isFullyActive && (
        <div className="mt-3 pt-3 flex items-center gap-2 border-t border-white/5">
          <div className="p-1.5 rounded-full bg-primary/10">
            <Repeat className="h-3 w-3 text-primary animate-pulse" />
          </div>
          <p className="text-[11px] font-medium text-primary">
            Pix Automático Ativo
            {subscription.next_charge_at && (
              <span className="text-muted-foreground font-normal ml-1">
                • Próximo: {formatDate(subscription.next_charge_at)}
              </span>
            )}
          </p>
        </div>
      )}

      {subscription && !isFullyActive && !isOverdue && mandateActive && (
        <div className="mt-3 pt-3 flex items-center gap-2 border-t border-white/5">
          <div className="p-1.5 rounded-full bg-amber-500/10">
            <Clock className="h-3 w-3 text-amber-500" />
          </div>
          <p className="text-[11px] font-medium text-amber-600">
            Pix Automático autorizado • 1ª cobrança em breve
          </p>
        </div>
      )}
    </div>
  );
};
