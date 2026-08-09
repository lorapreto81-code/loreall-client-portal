import { useEffect, useState } from "react";
import { Loader2, RefreshCw, User, Mail, Calendar, CheckCircle2, XCircle, CreditCard } from "lucide-react";
import { syncpayAdmin } from "@/lib/syncpayAdmin";
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
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
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
        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
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
        </div>
      )}
    </div>
  );
}
