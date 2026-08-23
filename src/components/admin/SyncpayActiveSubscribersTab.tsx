import { useEffect, useState } from "react";
import { Loader2, RefreshCw, User, Mail, Calendar, CheckCircle2, XCircle, CreditCard } from "lucide-react";
import { syncpayAdmin } from "@/lib/resellerAdmin";
import { toast } from "sonner";

interface Subscription {
  id: string;
  syncpay_subscription_id: string;
  customer_name: string;
  customer_email: string;
  customer_whatsapp: string;
  status: string;
  next_charge_at: string | null;
  plan_name: string;
  amount: number;
  created_at: string;
}

export default function SyncpayActiveSubscribersTab() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [subscribers, setSubscribers] = useState<Subscription[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await syncpayAdmin.listAllSubscribers();
      setSubscribers(res.subscribers || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carrergar assinantes");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncpayAdmin.syncSubscribers();
      toast.success(`${res.synced} assinatura(s) sincronizada(s) com a SyncPay.`);
      if (res.errors?.length) {
        toast.warning(`${res.errors.length} plano(s) com erro ao sincronizar.`);
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const formatDate = (s: string | null) => {
    if (!s) return "—";
    return new Date(s).toLocaleDateString("pt-BR");
  };

  const statusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "active" || s === "paid") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3" /> Ativa
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
        <XCircle className="h-3 w-3" /> {status}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Assinaturas Automáticas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Clientes com recorrência ativa via SyncPay.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Sincronizar com SyncPay
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : subscribers.length === 0 ? (
        <div className="card-elevated p-8 text-center text-sm text-muted-foreground">
          Nenhuma assinatura automática encontrada.
        </div>
      ) : (
        <div className="card-elevated border border-border/50 rounded-2xl">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Cliente</th>
                  <th className="text-left px-4 py-3">Plano</th>
                  <th className="text-left px-4 py-3">Valor</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Próx. Cobrança</th>
                  <th className="text-left px-4 py-3">Início</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{sub.customer_name}</div>
                      <div className="text-[11px] text-muted-foreground flex flex-col">
                        <span className="flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> {sub.customer_email}</span>
                        <span>📱 {sub.customer_whatsapp || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium">{sub.plan_name}</td>
                    <td className="px-4 py-3 text-foreground">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(sub.amount)}
                    </td>
                    <td className="px-4 py-3">{statusBadge(sub.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-foreground">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatDate(sub.next_charge_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDate(sub.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-border">
            {subscribers.map((sub) => (
              <div key={sub.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-foreground truncate">{sub.customer_name}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {sub.customer_email}
                    </div>
                    <div className="text-[11px] text-muted-foreground">📱 {sub.customer_whatsapp || "—"}</div>
                  </div>
                  <div className="shrink-0">{statusBadge(sub.status)}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/30 p-2 rounded-lg">
                    <div className="text-muted-foreground mb-0.5 font-bold uppercase tracking-tighter">Plano</div>
                    <div className="font-bold text-foreground truncate">{sub.plan_name}</div>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-lg">
                    <div className="text-muted-foreground mb-0.5 font-bold uppercase tracking-tighter">Valor</div>
                    <div className="font-bold text-foreground">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(sub.amount)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Cobrança: {formatDate(sub.next_charge_at)}
                  </div>
                  <div>Início: {formatDate(sub.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
