import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, Users, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { listCustomers } from "@/lib/api";
import { toast } from "sonner";

interface TGCustomer {
  id: number;
  name: string;
  usuario?: string;
  password?: string;
  whatsapp?: string;
  email?: string;
  status?: string;
  data_de_vencimento?: string;
  telas?: number;
  product?: { id: number; name: string } | null;
  plan?: { id: number; name: string; value?: string } | null;
}

interface Meta {
  current_page: number;
  per_page: number;
  total: number;
  last_page?: number;
}

function formatPhone(raw?: string) {
  if (!raw) return "—";
  const d = raw.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith("55")) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

function formatDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR");
}

function statusBadge(status?: string) {
  const s = (status || "").toLowerCase();
  const active = s === "ativo";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
        active
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
      }`}
    >
      {active ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {status || "—"}
    </span>
  );
}

export default function TopGestorCustomersTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customers, setCustomers] = useState<TGCustomer[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [page, setPage] = useState(1);
  const [perPage] = useState(100);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "ativo" | "vencido">("");

  const load = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await listCustomers({
        per_page: perPage,
        page,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      const data: TGCustomer[] = Array.isArray(res?.data) ? res.data : [];
      setCustomers(data);
      setMeta(res?.meta || null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar clientes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  const stats = useMemo(() => {
    const total = meta?.total ?? customers.length;
    const ativos = customers.filter((c) => (c.status || "").toLowerCase() === "ativo").length;
    const vencidos = customers.length - ativos;
    const porPlano = new Map<string, number>();
    customers.forEach((c) => {
      const name = c.plan?.name || "—";
      porPlano.set(name, (porPlano.get(name) || 0) + 1);
    });
    return { total, ativos, vencidos, porPlano: Array.from(porPlano.entries()).sort((a, b) => b[1] - a[1]) };
  }, [customers, meta]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const exportCSV = () => {
    const rows = [
      ["ID", "Nome", "Usuário", "WhatsApp", "Email", "Status", "Vencimento", "Telas", "Plano", "Valor", "Produto"],
      ...customers.map((c) => [
        c.id,
        c.name,
        c.usuario || "",
        c.whatsapp || "",
        c.email || "",
        c.status || "",
        c.data_de_vencimento || "",
        c.telas ?? "",
        c.plan?.name || "",
        c.plan?.value || "",
        c.product?.name || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-topgestor-pagina-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lastPage = meta?.last_page ?? Math.max(1, Math.ceil((meta?.total || customers.length) / perPage));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Clientes TopGestor</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={loading || customers.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-input hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
          <button
            onClick={() => load({ silent: true })}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-input hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card-elevated p-4">
          <p className="text-[11px] text-muted-foreground uppercase">Total</p>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="card-elevated p-4">
          <p className="text-[11px] text-muted-foreground uppercase">Ativos (página)</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.ativos}</p>
        </div>
        <div className="card-elevated p-4">
          <p className="text-[11px] text-muted-foreground uppercase">Vencidos (página)</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.vencidos}</p>
        </div>
        <div className="card-elevated p-4">
          <p className="text-[11px] text-muted-foreground uppercase">Página</p>
          <p className="text-2xl font-bold text-foreground">
            {meta?.current_page || page} / {lastPage}
          </p>
        </div>
      </div>

      {/* Por plano */}
      {stats.porPlano.length > 0 && (
        <div className="card-elevated p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Por plano (página atual)</p>
          <div className="flex flex-wrap gap-2">
            {stats.porPlano.map(([name, count]) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
              >
                {name} <span className="text-foreground/70">· {count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <form onSubmit={handleSearchSubmit} className="card-elevated p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, usuário, WhatsApp, email..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-card text-sm text-foreground"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "" | "ativo" | "vencido");
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg border border-input bg-card text-sm text-foreground"
        >
          <option value="">Todos os status</option>
          <option value="ativo">Apenas ativos</option>
          <option value="vencido">Apenas vencidos</option>
        </select>
        <button type="submit" className="px-4 py-2 rounded-lg btn-primary-gradient text-sm font-semibold">
          Buscar
        </button>
      </form>

      {/* Tabela */}
      <div className="card-elevated overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Nenhum cliente encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Cliente</th>
                  <th className="text-left px-3 py-2">WhatsApp</th>
                  <th className="text-left px-3 py-2">Plano</th>
                  <th className="text-center px-3 py-2">Telas</th>
                  <th className="text-left px-3 py-2">Vencimento</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition">
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.usuario ? `@${c.usuario}` : `ID ${c.id}`}
                        {c.email ? ` · ${c.email}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-foreground tabular-nums">{formatPhone(c.whatsapp)}</td>
                    <td className="px-3 py-2">
                      <div className="text-foreground">{c.plan?.name || "—"}</div>
                      {c.plan?.value && (
                        <div className="text-[11px] text-muted-foreground">R$ {c.plan.value}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-foreground">{c.telas ?? "—"}</td>
                    <td className="px-3 py-2 text-foreground">{formatDate(c.data_de_vencimento)}</td>
                    <td className="px-3 py-2">{statusBadge(c.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Mostrando {customers.length} {meta ? `de ${meta.total}` : ""} clientes
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-input hover:bg-muted disabled:opacity-50"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Anterior
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= lastPage || loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-input hover:bg-muted disabled:opacity-50"
          >
            Próxima <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
