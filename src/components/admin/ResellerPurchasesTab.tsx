import { useEffect, useState } from "react";
import { resellerAdmin } from "@/lib/resellerAdmin";
import { toast } from "sonner";
import { Loader2, RefreshCw, RotateCcw } from "lucide-react";


interface Purchase {
  id: string;
  warez_username: string;
  warez_user_id: number;
  package_credits: number;
  amount: number;
  status: string;
  recharge_status: string;
  paid_at: string | null;
  recharged_at: string | null;
  error_message: string | null;
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
  paid: "bg-blue-500/15 text-blue-400",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};
const rechargeBadge: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  processing: "bg-amber-500/15 text-amber-500",
  recharged: "bg-green-500/15 text-green-500",
  failed: "bg-destructive/15 text-destructive",
  awaiting_credits: "bg-orange-500/15 text-orange-500",
};

const rechargeLabel: Record<string, string> = {
  pending: "pendente",
  processing: "processando",
  recharged: "recarregado",
  failed: "falhou",
  awaiting_credits: "aguardando saldo",
};

export default function ResellerPurchasesTab() {
  const [items, setItems] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [reprocessing, setReprocessing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter) params.status = filter;
      const { purchases } = await resellerAdmin.listPurchases(params);
      setItems(purchases);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filter]);

  // Auto-refresh a cada 10s
  useEffect(() => {
    const i = setInterval(() => {
      load();
    }, 10000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const reprocess = async (id: string) => {
    setReprocessing(id);
    try {
      const r = await resellerAdmin.reprocess(id);
      if (r.result?.ok) toast.success("Recarga reprocessada");
      else toast.error(r.result?.error || "Falhou");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
    setReprocessing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-foreground">Histórico de recargas</h2>
        <div className="flex gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-card text-foreground text-sm">
            <option value="">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="paid">Pago</option>
            <option value="expired">Expirado</option>
            <option value="cancelled">Cancelado</option>
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
                  <th className="text-left px-3 py-3">Revendedor</th>
                  <th className="text-right px-3 py-3">Créd.</th>
                  <th className="text-right px-3 py-3">Valor</th>
                  <th className="text-center px-3 py-3">Pagto</th>
                  <th className="text-center px-3 py-3">Recarga</th>
                  <th className="text-left px-3 py-3">Pago em</th>
                  <th className="text-left px-3 py-3">Recarregado</th>
                  <th className="text-left px-3 py-3">Erro</th>
                  <th className="text-right px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const canReprocess = p.status === "paid" && p.recharge_status !== "recharged";
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(p.created_at)}</td>
                      <td className="px-3 py-2">
                        <div className="font-mono text-xs text-foreground">{p.warez_username}</div>
                        <div className="text-xs text-muted-foreground">#{p.warez_user_id}</div>
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">{p.package_credits}</td>
                      <td className="px-3 py-2 text-right text-foreground">{fmtBRL(p.amount)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge[p.status] || "bg-muted"}`}>{p.status}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${rechargeBadge[p.recharge_status] || "bg-muted"}`}>{rechargeLabel[p.recharge_status] || p.recharge_status}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(p.paid_at)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(p.recharged_at)}</td>
                      <td className="px-3 py-2 text-xs text-destructive max-w-[200px] truncate" title={p.error_message || ""}>{p.error_message || "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {canReprocess && (
                          <button onClick={() => reprocess(p.id)} disabled={reprocessing === p.id} className="px-2 py-1 rounded bg-primary/10 text-primary text-xs inline-flex items-center gap-1 hover:bg-primary/20 disabled:opacity-60">
                            {reprocessing === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                            Reprocessar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={10} className="text-center text-sm text-muted-foreground py-8">Nenhuma recarga.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
