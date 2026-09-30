import { useEffect, useMemo, useState } from "react";
import { resellerAdmin } from "@/lib/resellerAdmin";
import { Mail, Search, RefreshCcw, CheckCircle2, XCircle, Loader2, MinusCircle } from "lucide-react";

interface EmailLog {
  id: string;
  customer_id: number;
  due_date: string;
  kind: string;
  email: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

const KIND_LABEL: Record<string, string> = {
  "d-3": "3 dias antes", d3: "3 dias antes", "D-3": "3 dias antes",
  "d-1": "1 dia antes", d1: "1 dia antes", "D-1": "1 dia antes",
  d0: "No dia", "d-0": "No dia", D0: "No dia",
  "d+1": "Vencido", "D+1": "Vencido",
};
const kindLabel = (k: string) => KIND_LABEL[k] || (k.startsWith("d+") || k.startsWith("D+") ? `Vencido (${k.slice(1)} dias)` : k);

const STATUS: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  sent: { label: "Enviado", cls: "text-primary bg-primary/10", Icon: CheckCircle2 },
  failed: { label: "Falhou", cls: "text-destructive bg-destructive/10", Icon: XCircle },
  sending: { label: "Enviando", cls: "text-muted-foreground bg-muted", Icon: Loader2 },
  skipped: { label: "Ignorado", cls: "text-muted-foreground bg-muted", Icon: MinusCircle },
};

const fmtDate = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const fmtDue = (d: string) => d.split("-").reverse().join("/");

const EmailLogsTab = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await resellerAdmin.listEmailLogs();
      setLogs(res.logs || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return logs.filter((l) =>
      (status === "all" || l.status === status) &&
      (!t || (l.email || "").toLowerCase().includes(t) || String(l.customer_id).includes(t)));
  }, [logs, q, status]);

  const counts = useMemo(() => {
    const today = new Date().toDateString();
    return {
      total: logs.length,
      sent: logs.filter((l) => l.status === "sent").length,
      failed: logs.filter((l) => l.status === "failed").length,
      today: logs.filter((l) => l.status === "sent" && new Date(l.created_at).toDateString() === today).length,
    };
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Total registrado", counts.total],
          ["Enviados", counts.sent],
          ["Enviados hoje", counts.today],
          ["Falhas", counts.failed],
        ].map(([label, v]) => (
          <div key={label as string} className="card-elevated p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground">{v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por e-mail ou ID do cliente"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-input bg-card text-foreground text-sm">
          <option value="all">Todos</option>
          <option value="sent">Enviados</option>
          <option value="failed">Falhas</option>
          <option value="sending">Enviando</option>
          <option value="skipped">Ignorados</option>
        </select>
        <button onClick={load} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-input bg-card text-sm text-foreground hover:bg-muted">
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="card-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
            <tr>
              <th className="p-3">Data do envio</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">E-mail</th>
              <th className="p-3">Lembrete</th>
              <th className="p-3">Vencimento</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                <Mail className="h-6 w-6 mx-auto mb-2 opacity-50" />Nenhum e-mail encontrado.
              </td></tr>
            ) : filtered.map((l) => {
              const s = STATUS[l.status] || { label: l.status, cls: "text-muted-foreground bg-muted", Icon: MinusCircle };
              return (
                <tr key={l.id} className="border-b border-border/50 last:border-0">
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{fmtDate(l.created_at)}</td>
                  <td className="p-3 whitespace-nowrap font-medium text-foreground">#{l.customer_id}</td>
                  <td className="p-3 text-foreground break-all">{l.email || "—"}</td>
                  <td className="p-3 whitespace-nowrap">{kindLabel(l.kind)}</td>
                  <td className="p-3 whitespace-nowrap">{fmtDue(l.due_date)}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
                      <s.Icon className="h-3.5 w-3.5" />{s.label}
                    </span>
                    {l.error && <p className="text-xs text-destructive mt-1 max-w-xs break-words">{l.error}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmailLogsTab;
