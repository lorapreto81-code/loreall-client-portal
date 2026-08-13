import { useEffect, useState } from "react";
import { resellerAdmin } from "@/lib/resellerAdmin";
import { toast } from "sonner";
import { Loader2, RefreshCw, Trash2, CheckCircle2 } from "lucide-react";

interface Payment {
  id: string;
  customer_id: number;
  customer_name: string;
  customer_whatsapp: string | null;
  plan_id: number;
  plan_name: string;
  amount: number;
  fastdepix_status: string;
  paid_at: string | null;
  renewed_at: string | null;
  created_at: string;
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function fmtBRL(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const statusBadge: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-500",
  PENDING: "bg-amber-500/15 text-amber-500",
  paid: "bg-green-500/15 text-green-500",
  PAID: "bg-green-500/15 text-green-500",
  expired: "bg-muted text-muted-foreground",
  EXPIRED: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};
const statusLabel: Record<string, string> = {
  pending: "pendente",
  PENDING: "pendente",
  paid: "pago",
  PAID: "pago",
  expired: "expirado",
  EXPIRED: "expirado",
  cancelled: "cancelado",
};

function extractMeses(plan: string): string {
  if (!plan) return "—";
  const m = plan.match(/(\d+)\s*(mes|mês|meses|m)\b/i);
  if (m) return `${m[1]}m`;
  const a = plan.match(/(\d+)\s*(ano|anos)/i);
  if (a) return `${Number(a[1]) * 12}m`;
  return "—";
}

export default function CustomersPaymentsTab() {
  const [items, setItems] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter) params.status = filter;
      const { payments } = await resellerAdmin.listPayments(params);
      setItems(payments);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filter]);

  useEffect(() => {
    const i = setInterval(load, 15000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-foreground">Histórico de pagamentos (clientes)</h2>
        <div className="flex gap-2 flex-wrap">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-card text-foreground text-sm">
            <option value="">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="paid">Pago</option>
            <option value="expired">Expirado</option>
          </select>
          <button onClick={load} className="px-3 py-2 rounded-lg border border-border text-sm inline-flex items-center gap-1.5">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-3">Data</th>
                  <th className="text-left px-3 py-3">Cliente</th>
                  <th className="text-left px-3 py-3">Plano</th>
                  <th className="text-center px-3 py-3">Meses</th>
                  <th className="text-right px-3 py-3">Valor</th>
                  <th className="text-center px-3 py-3">Status</th>
                  <th className="text-left px-3 py-3">Pago em</th>
                  <th className="text-left px-3 py-3">Renovado</th>
                  <th className="text-right px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(p.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-foreground">{p.customer_name}</div>
                      <div className="text-xs text-muted-foreground">#{p.customer_id}{p.customer_whatsapp ? ` · ${p.customer_whatsapp}` : ""}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-foreground">{p.plan_name}</td>
                    <td className="px-3 py-2 text-center text-xs text-muted-foreground">{extractMeses(p.plan_name)}</td>
                    <td className="px-3 py-2 text-right text-foreground">{fmtBRL(p.amount)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge[p.fastdepix_status] || "bg-muted"}`}>
                        {statusLabel[p.fastdepix_status] || p.fastdepix_status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(p.paid_at)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(p.renewed_at)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {p.fastdepix_status !== "paid" && p.fastdepix_status !== "PAID" && (
                          <button
                            title="Confirmar Pagamento e Renovar"
                            onClick={async () => {
                              if (!confirm(`Confirmar recebimento de ${fmtBRL(p.amount)} de ${p.customer_name} e RENOVAR no TopGestor?`)) return;
                              try {
                                await resellerAdmin.confirmPayment(p.id);
                                toast.success("Pagamento confirmado e renovação enviada!");
                                await load();
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Erro ao confirmar");
                              }
                            }}
                            className="p-1.5 rounded bg-green-500/10 text-green-500 hover:bg-green-500/20"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          title="Apagar do histórico"
                          onClick={async () => {
                            if (!confirm(`APAGAR definitivamente esse pagamento de ${p.customer_name}? Isso não devolve dinheiro nem afeta a assinatura.`)) return;
                            try {
                              await resellerAdmin.deletePayment(p.id);
                              toast.success("Registro apagado");
                              await load();
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Erro");
                            }
                          }}
                          className="p-1.5 rounded bg-destructive/10 text-destructive hover:bg-destructive/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-sm text-muted-foreground py-8">Nenhum pagamento.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
