import { CalendarDays, Monitor, Sparkles, Repeat, Clock, Settings, AlertTriangle, Zap } from "lucide-react";
import { Customer } from "@/store/authStore";
import { formatDate, daysUntil } from "@/lib/format";
import { getStatusPill, telasLabel } from "@/utils/constants";
import { useActiveSubscription } from "@/features/dashboard/hooks/useActiveSubscription";

interface PlanCardProps {
  customer: Customer;
  days: number;
  onRenewClick: () => void;
}

export const PlanCard = ({ customer, days, onRenewClick }: PlanCardProps) => {
  const pill = getStatusPill(days);
  const points = (customer as any).pontos || (customer as any).meta?.pontos;

  const { data: subscription } = useActiveSubscription(customer.id);
  const mandateActive = subscription?.mandate_status?.toUpperCase() === "ACTIVE";
  const isFullyActive = subscription?.status === "active";
  const isOverdue = subscription?.status === "overdue";
  const isPending = subscription && !isFullyActive && !isOverdue;

  const daysToCharge = subscription?.next_charge_at ? daysUntil(subscription.next_charge_at) : null;

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

      {/* Sem assinatura automática: botão de renovar de sempre */}
      {!subscription && (
        <button
          onClick={onRenewClick}
          className="group btn-primary-gradient font-semibold text-sm flex items-center justify-center gap-2 w-full relative overflow-hidden mt-4"
          style={{ minHeight: 52, borderRadius: 14 }}
        >
          <Zap className="h-4 w-4 group-hover:scale-110 transition-transform" />
          Renovar acesso
        </button>
      )}

      {/* Autorizado, confirmando primeiro pagamento */}
      {isPending && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600">
              CONFIRMANDO
            </span>
          </div>
          <div className="flex items-start gap-2.5 bg-amber-500/10 rounded-xl p-3">
            <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Banco autorizado. Ativando sua assinatura e confirmando o primeiro pagamento —
              isso leva só alguns minutos.
            </p>
          </div>
        </div>
      )}

      {/* Assinatura ativa */}
      {isFullyActive && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <div className="flex items-center gap-2 mb-2.5">
            <Repeat className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">Assinatura ativa</span>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 flex items-center justify-between gap-2 mb-2.5">
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Próxima cobrança</p>
              <p className="text-sm font-semibold text-foreground">
                {subscription.next_charge_at ? formatDate(subscription.next_charge_at) : "—"}
              </p>
            </div>
            {subscription.amount != null && (
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground mb-0.5">Valor</p>
                <p className="text-sm font-semibold text-foreground">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(subscription.amount)}
                </p>
              </div>
            )}
            {daysToCharge != null && (
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground mb-0.5">Faltam</p>
                <p className="text-sm font-semibold text-primary">{daysToCharge >= 0 ? `${daysToCharge}d` : "—"}</p>
              </div>
            )}
          </div>
          <button
            onClick={onRenewClick}
            className="w-full text-xs font-medium text-muted-foreground border border-border rounded-lg py-2 flex items-center justify-center gap-1.5 hover:bg-muted/50 transition-colors"
          >
            <Settings className="h-3.5 w-3.5" /> Gerenciar assinatura
          </button>
        </div>
      )}

      {/* Pagamento em atraso */}
      {isOverdue && (
        <button
          onClick={onRenewClick}
          className="mt-4 w-full p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-2.5 text-left hover:bg-destructive/15 transition-colors"
        >
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-destructive">Pagamento em atraso</p>
            <p className="text-[11px] text-muted-foreground">Toque para regularizar sua assinatura automática.</p>
          </div>
        </button>
      )}
    </div>
  );
};
