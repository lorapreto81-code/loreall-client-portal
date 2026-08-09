import React, { useEffect, useState } from "react";
import { resellerAdmin } from "@/lib/resellerAdmin";
import { CheckCircle2, XCircle, Search, Filter, Calendar, User, CreditCard, RefreshCcw, Info, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PaymentAudit {
  id: string;
  customer_id: number;
  customer_name: string;
  plan_name: string;
  amount: number;
  fastdepix_status: string;
  renewed_at: string | null;
  renewal_response: any;
  created_at: string;
  provider: string;
}

const PaymentAuditTab = () => {
  const [payments, setPayments] = useState<PaymentAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "success" | "error">("all");

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const data = await resellerAdmin.listPayments();
      const list = Array.isArray(data) ? data : (data.payments || []);
      setPayments(list);
    } catch (error) {
      console.error("Error fetching payment logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = 
      p.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customer_id.toString().includes(searchTerm) ||
      p.plan_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filter === "success") return matchesSearch && p.renewed_at !== null;
    if (filter === "error") return matchesSearch && p.fastdepix_status === "paid" && p.renewed_at === null;
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <RefreshCcw className="h-6 w-6 text-primary" />
            Auditoria de Renovações
          </h2>
          <p className="text-sm text-muted-foreground">Histórico de renovações no TopGestor e pagamentos PIX</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filter === "all" ? "bg-card shadow-sm text-foreground border border-border/50" : "text-muted-foreground hover:text-foreground"}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter("success")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filter === "success" ? "bg-card shadow-sm text-green-500 border border-green-500/20" : "text-muted-foreground hover:text-foreground"}`}
            >
              Sucesso
            </button>
            <button
              onClick={() => setFilter("error")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filter === "error" ? "bg-card shadow-sm text-red-500 border border-red-500/20" : "text-muted-foreground hover:text-foreground"}`}
            >
              Falhas
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar cliente ou plano..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="card-elevated overflow-hidden border border-border/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-6 py-4 font-semibold text-foreground">Data/Hora</th>
                <th className="px-6 py-4 font-semibold text-foreground">Cliente</th>
                <th className="px-6 py-4 font-semibold text-foreground">Plano / Valor</th>
                <th className="px-6 py-4 font-semibold text-foreground">Pagamento</th>
                <th className="px-6 py-4 font-semibold text-foreground">Renovação TopGestor</th>
                <th className="px-6 py-4 font-semibold text-foreground text-center">Status Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Carregando auditoria...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const isSuccess = p.renewed_at !== null;
                  const isPaid = p.fastdepix_status === "paid" || p.fastdepix_status === "PAID";
                  const isError = isPaid && !isSuccess;
                  
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{p.customer_name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">ID: {p.customer_id}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-foreground">{p.plan_name}</span>
                          <span className="text-[10px] font-bold text-primary">R$ {p.amount.toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isPaid ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-muted text-muted-foreground border border-border"
                        }`}>
                          {p.fastdepix_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isSuccess ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 text-green-500 text-xs font-semibold">
                              <CheckCircle2 className="h-3 w-3" />
                              Sucesso
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(p.renewed_at!), "HH:mm:ss", { locale: ptBR })}
                            </span>
                          </div>
                        ) : isError ? (
                          <div className="flex flex-col max-w-[180px]">
                            <span className="inline-flex items-center gap-1 text-red-500 text-xs font-semibold">
                              <AlertCircle className="h-3 w-3" />
                              Falha na Renovação
                            </span>
                            <span className="text-[10px] text-red-400/80 truncate italic" title={JSON.stringify(p.renewal_response)}>
                              {p.renewal_response?.message || p.renewal_response?.error || "Erro desconhecido"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Aguardando PIX</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button 
                          onClick={() => alert(JSON.stringify(p.renewal_response || "Sem detalhes da API", null, 2))}
                          className={`p-1.5 rounded-full transition-colors ${
                            isError ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "hover:bg-muted text-muted-foreground"
                          }`}
                          title="Ver resposta bruta da API"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PaymentAuditTab;
