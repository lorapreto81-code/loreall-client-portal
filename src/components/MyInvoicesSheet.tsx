import { authHeaders } from "@/lib/api";
import { useEffect, useState } from "react";
import { X, Receipt, Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Invoice {
  id: string;
  amount: number;
  plan_name: string;
  provider: string;
  fastdepix_status: string;
  paid_at: string | null;
  created_at: string;
  renewed_at: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  customerId: number;
}

function fmtBRL(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const statusInfo = (s: string) => {
  const st = (s || "").toLowerCase();
  if (["paid", "approved", "completed"].includes(st))
    return { label: "Pago", color: "hsl(var(--success, 142 71% 45%))", bg: "hsl(142 71% 45% / 0.12)", Icon: CheckCircle2 };
  if (["pending"].includes(st))
    return { label: "Pendente", color: "#B47700", bg: "rgba(250,199,117,0.20)", Icon: Clock };
  return { label: "Expirado", color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted))", Icon: XCircle };
};

export default function MyInvoicesSheet({ open, onClose, customerId }: Props) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/payment-status`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ action: "history", customer_id: customerId, limit: 30 }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
        if (!cancel) setItems(data.payments || []);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "Erro");
      }
      if (!cancel) setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [open, customerId]);

  if (!open) return null;

  const paidCount = items.filter((i) => ["paid", "approved", "completed"].includes(i.fastdepix_status?.toLowerCase())).length;
  const pendingCount = items.filter((i) => ["pending"].includes(i.fastdepix_status?.toLowerCase())).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-background sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Minhas faturas</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-2 gap-2 p-4 border-b border-border">
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Faturas pagas</div>
              <div className="text-lg font-bold text-foreground">{paidCount}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Pendentes</div>
              <div className="text-lg font-bold text-foreground">{pendingCount}</div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {error && (
            <div className="text-sm text-destructive text-center py-8">{error}</div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="text-center py-16">
              <Receipt className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma fatura ainda.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Suas renovações via PIX aparecem aqui.</p>
            </div>
          )}
          {!loading && !error && items.map((inv) => {
            const st = statusInfo(inv.fastdepix_status);
            const StIcon = st.Icon;
            const isPaid = ["paid", "approved", "completed"].includes(inv.fastdepix_status?.toLowerCase());
            return (
              <div key={inv.id} className="card-elevated p-3.5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground truncate">{inv.plan_name}</div>
                    <div className="text-[11px] text-muted-foreground">Criada em {fmtDateTime(inv.created_at)}</div>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{ background: st.bg, color: st.color }}
                  >
                    <StIcon className="h-3 w-3" />
                    {st.label.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="text-[11px] text-muted-foreground">
                    {isPaid && inv.paid_at ? `Pago em ${fmtDate(inv.paid_at)}` : "Aguardando pagamento"}
                  </div>
                  <div className="text-base font-bold text-foreground">{fmtBRL(inv.amount)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
