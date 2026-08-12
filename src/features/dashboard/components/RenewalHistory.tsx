import { useState, useEffect } from "react";
import { Receipt, Calendar, CheckCircle2, XCircle, Clock, Info, ChevronRight, History } from "lucide-react";
import { CustomerService, TopGestorInvoice } from "@/services/customer/CustomerService";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  customerId: number;
}

export function RenewalHistory({ customerId }: Props) {
  const [invoices, setInvoices] = useState<TopGestorInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvoices() {
      try {
        setLoading(true);
        const response = await CustomerService.getInvoices(customerId, 20);
        // Filtramos apenas as faturas pagas
        const data = (response.data || []).filter(inv => {
          const s = (inv.status || "").toLowerCase();
          return ["pago", "paid", "approved", "completed"].includes(s);
        });
        setError(null);
      } catch (err) {
        console.error("Failed to load invoices:", err);
        setError("Não foi possível carregar o histórico.");
      } finally {
        setLoading(false);
      }
    }

    if (customerId) {
      loadInvoices();
    }
  }, [customerId]);

  function fmtBRL(n: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  }

  function fmtDate(s: string | null) {
    if (!s) return "—";
    return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  const getStatusInfo = (status: string) => {
    const s = status.toLowerCase();
    if (s === "pago" || s === "paid" || s === "approved") {
      return { label: "Pago", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 };
    }
    if (s === "vencido" || s === "expired" || s === "overdue") {
      return { label: "Vencido", color: "text-destructive", bg: "bg-destructive/10", icon: XCircle };
    }
    if (s === "pendente" || s === "pending") {
      return { label: "Pendente", color: "text-amber-500", bg: "bg-amber-500/10", icon: Clock };
    }
    return { label: status, color: "text-muted-foreground", bg: "bg-muted", icon: Info };
  };

  if (loading) {
    return (
      <div className="card-elevated p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <History className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Histórico de Renovações</h3>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error || invoices.length === 0) {
    if (invoices.length === 0 && !loading && !error) {
      return (
        <div className="p-6 text-center">
          <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-foreground">Sem histórico de renovações pagas</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Suas futuras renovações aparecerão aqui.
          </p>
        </div>
      );
    }
    return null; // Oculta se houver erro crítico para não poluir
  }

  return (
    <div className="overflow-hidden">
      <div className="py-2 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground tracking-tight">Histórico de Renovações</h3>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border/50">
        {invoices.map((invoice) => {
          const status = getStatusInfo(invoice.status);
          const StatusIcon = status.icon;
          
          return (
            <div key={invoice.id} className="p-4 hover:bg-white/[0.01] transition-colors group">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {invoice.plan_name || "Renovação de Acesso"}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {fmtDate(invoice.paid_at || invoice.due_date)}
                    </span>
                    <span className="text-[11px] font-bold text-foreground/80">
                      {fmtBRL(invoice.amount)}
                    </span>
                  </div>
                </div>
                
                <div className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-current/10",
                  status.bg,
                  status.color
                )}>
                  <StatusIcon className="h-3 w-3" />
                  <span className="text-[10px] font-bold uppercase tracking-tight">
                    {status.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {invoices.length >= 10 && (
        <div className="p-3 text-center bg-white/[0.01]">
          <p className="text-[10px] text-muted-foreground italic">
            Mostrando as últimas 10 transações
          </p>
        </div>
      )}
    </div>
  );
}