import React, { useEffect, useState } from "react";
import { resellerAdmin } from "@/lib/resellerAdmin";
import { History, ShieldCheck, ShieldAlert, Phone, Calendar, User, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OtpLog {
  id: string;
  phone: string;
  customer_id: number | null;
  created_at: string;
  consumed_at: string | null;
  ip_address: string | null;
  attempts: number;
}

const OtpAuditTab = () => {
  const [logs, setLogs] = useState<OtpLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      // We'll use the reseller-admin proxy to fetch logs
      const data = await resellerAdmin.listOtpLogs();
      setLogs(data.logs || []);
    } catch (error) {
      console.error("Error fetching OTP logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => 
    log.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.customer_id && log.customer_id.toString().includes(searchTerm))
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Auditoria de Acessos
          </h2>
          <p className="text-sm text-muted-foreground">Monitoramento de solicitações de código WhatsApp</p>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por número ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>
      </div>

      <div className="card-elevated overflow-hidden border border-border/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-6 py-4 font-semibold text-foreground">Data/Hora</th>
                <th className="px-6 py-4 font-semibold text-foreground">Identificador</th>
                <th className="px-6 py-4 font-semibold text-foreground">ID Cliente</th>
                <th className="px-6 py-4 font-semibold text-foreground">Status</th>
                <th className="px-6 py-4 font-semibold text-foreground">Tentativas</th>
                <th className="px-6 py-4 font-semibold text-foreground">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Carregando registros...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {log.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {log.customer_id || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.consumed_at ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                          <ShieldCheck className="h-3 w-3" />
                          Autenticado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          <ShieldAlert className="h-3 w-3" />
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-muted-foreground">
                      {log.attempts}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-muted-foreground font-mono">
                      {log.ip_address || "N/A"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OtpAuditTab;
