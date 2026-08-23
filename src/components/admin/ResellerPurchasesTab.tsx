import { useEffect, useState } from "react";
import { resellerAdmin } from "@/lib/resellerAdmin";
import { toast } from "sonner";
import { Loader2, RefreshCw, RotateCcw, Check, Trash2 } from "lucide-react";


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
const statusLabel: Record<string, string> = {
  pending: "pendente",
  paid: "pago",
  expired: "expirado",
  cancelled: "cancelado",
};

function friendlyError(msg: string | null): string {
  if (!msg) return "—";
  const low = msg.toLowerCase();
  if (low.includes("insufficient") || low.includes("saldo insuficiente") || low.includes("créditos insuficientes") || low.includes("creditos insuficientes") || low.includes("not enough credit") || low.includes("no credits")) {
    return "Créditos insuficientes no painel";
  }
  if (low.includes("warez http 401") || low.includes("unauthorized")) return "Token do painel inválido";
  if (low.includes("warez http 404")) return "Usuário não encontrado no painel";
  if (low.includes("warez http 5")) return "Painel WPainel indisponível";
  if (low.includes("warez http 400")) {
    // tenta extrair "message"
    const m = msg.match(/"message"\s*:\s*"([^"]+)"/i);
    if (m) return m[1];
    return "Requisição rejeitada pelo painel";
  }
  if (low.includes("aborted") || low.includes("timeout")) return "Tempo esgotado ao falar com o painel";
  return msg.length > 80 ? msg.slice(0, 80) + "…" : msg;
}
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
        <div className="flex gap-2 flex-wrap">
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
          <button
            onClick={async () => {
              const pendentes = items.filter((p) => p.status === "paid" && p.recharge_status !== "recharged" && p.recharge_status !== "processing");
              if (pendentes.length === 0) { toast.info("Nenhuma compra paga aguardando recarga"); return; }
              toast.info(`Reprocessando ${pendentes.length} compra(s)...`);
              for (const p of pendentes) {
                try { await resellerAdmin.reprocess(p.id); } catch { /* segue */ }
              }
              await load();
              toast.success("Reprocessamento concluído");
            }}
            className="px-3 py-2 rounded-lg bg-orange-500/10 text-orange-500 text-sm inline-flex items-center gap-1.5 hover:bg-orange-500/20"
          >
            <RotateCcw className="h-4 w-4" /> Reprocessar pendentes
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="card-elevated border border-border/50 rounded-2xl">
          <div className="hidden md:block overflow-x-auto">
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
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge[p.status] || "bg-muted"}`}>{statusLabel[p.status] || p.status}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${rechargeBadge[p.recharge_status] || "bg-muted"}`}>{rechargeLabel[p.recharge_status] || p.recharge_status}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(p.paid_at)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(p.recharged_at)}</td>
                      <td className="px-3 py-2 text-xs text-destructive max-w-[220px] truncate" title={p.error_message || ""}>{friendlyError(p.error_message)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {p.status === "pending" && (
                            <button
                              onClick={async () => {
                                if (!confirm(`Marcar essa compra de ${p.warez_username} como PAGA e disparar a recarga?`)) return;
                                try {
                                  await resellerAdmin.markPaid(p.id);
                                  toast.success("Compra marcada como paga");
                                  await load();
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : "Erro");
                                }
                              }}
                              className="px-2 py-1 rounded bg-green-500/10 text-green-500 text-xs inline-flex items-center gap-1 hover:bg-green-500/20"
                            >
                              <Check className="h-3 w-3" /> Pagar
                            </button>
                          )}
                          {canReprocess && (
                            <button onClick={() => reprocess(p.id)} disabled={reprocessing === p.id} className="px-2 py-1 rounded bg-primary/10 text-primary text-xs inline-flex items-center gap-1 hover:bg-primary/20 disabled:opacity-60">
                              {reprocessing === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                              Reprocessar
                            </button>
                          )}
                          <button
                            title="Apagar do histórico"
                            onClick={async () => {
                              if (!confirm(`APAGAR definitivamente essa compra de ${p.warez_username}? Isso remove o registro do histórico (não devolve dinheiro nem mexe no painel).`)) return;
                              try {
                                await resellerAdmin.deletePurchase(p.id);
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
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={10} className="text-center text-sm text-muted-foreground py-8">Nenhuma recarga.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-border">
            {items.map((p) => {
              const canReprocess = p.status === "paid" && p.recharge_status !== "recharged";
              return (
                <div key={p.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-mono text-sm text-foreground">{p.warez_username}</div>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">#{p.warez_user_id} • {fmtDate(p.created_at)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${statusBadge[p.status] || "bg-muted"}`}>
                        {statusLabel[p.status] || p.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${rechargeBadge[p.recharge_status] || "bg-muted"}`}>
                        {rechargeLabel[p.recharge_status] || p.recharge_status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/30 p-2 rounded-lg">
                      <div className="text-muted-foreground mb-0.5 uppercase font-bold tracking-tighter">Créditos</div>
                      <div className="font-bold text-foreground">{p.package_credits}</div>
                    </div>
                    <div className="bg-muted/30 p-2 rounded-lg">
                      <div className="text-muted-foreground mb-0.5 uppercase font-bold tracking-tighter">Valor</div>
                      <div className="font-bold text-foreground">{fmtBRL(p.amount)}</div>
                    </div>
                  </div>

                  {p.error_message && (
                    <div className="p-2 rounded-lg bg-destructive/5 border border-destructive/20 text-[11px] text-destructive">
                      <strong>Erro:</strong> {friendlyError(p.error_message)}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                    <div className="text-[10px] text-muted-foreground italic">
                      {p.paid_at ? `Pago em ${fmtDate(p.paid_at)}` : "Aguardando pagamento"}
                    </div>
                    <div className="flex gap-1">
                      {p.status === "pending" && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Marcar como PAGA?`)) return;
                            try { await resellerAdmin.markPaid(p.id); toast.success("Paga"); await load(); } catch (e) { toast.error("Erro"); }
                          }}
                          className="p-2 rounded-lg bg-green-500/10 text-green-500"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      {canReprocess && (
                        <button onClick={() => reprocess(p.id)} disabled={reprocessing === p.id} className="p-2 rounded-lg bg-primary/10 text-primary disabled:opacity-50">
                          {reprocessing === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (!confirm(`APAGAR definitivamente?`)) return;
                          try { await resellerAdmin.deletePurchase(p.id); toast.success("Apagada"); await load(); } catch (e) { toast.error("Erro"); }
                        }}
                        className="p-2 rounded-lg bg-destructive/10 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {items.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">Nenhuma recarga.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
