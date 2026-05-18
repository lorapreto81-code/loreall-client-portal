import { useEffect, useState } from "react";
import { resellerAdmin } from "@/lib/resellerAdmin";
import { toast } from "sonner";
import { Loader2, TrendingUp, DollarSign, Receipt, Percent, ShoppingCart, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Kpis {
  revenue_month: number;
  cost_month: number;
  profit_month: number;
  margin_pct: number;
  count_month: number;
  ticket_avg: number;
  cost_per_credit: number;
}

interface PerReseller {
  warez_username: string;
  count: number;
  credits: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

interface Series {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
}

function fmtBRL(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ResellerDashboardTab() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [perReseller, setPerReseller] = useState<PerReseller[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [costInput, setCostInput] = useState("");
  const [savingCost, setSavingCost] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await resellerAdmin.dashboard();
      setKpis(d.kpis);
      setPerReseller(d.per_reseller);
      setSeries(d.series_30d);
      setCostInput(String(d.kpis.cost_per_credit ?? ""));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const saveCost = async () => {
    setSavingCost(true);
    try {
      await resellerAdmin.updateConfig({ credit_cost_brl: String(Number(costInput) || 0) });
      toast.success("Custo atualizado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
    setSavingCost(false);
  };

  if (loading || !kpis) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Dashboard de lucro</h2>
        <button onClick={load} className="px-3 py-2 rounded-lg border border-border text-sm inline-flex items-center gap-1.5">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={DollarSign} label="Receita mês" value={fmtBRL(kpis.revenue_month)} />
        <Kpi icon={Receipt} label="Custo mês" value={fmtBRL(kpis.cost_month)} />
        <Kpi icon={TrendingUp} label="Lucro mês" value={fmtBRL(kpis.profit_month)} positive={kpis.profit_month > 0} />
        <Kpi icon={Percent} label="Margem" value={`${kpis.margin_pct.toFixed(1)}%`} />
        <Kpi icon={ShoppingCart} label="Recargas" value={String(kpis.count_month)} />
        <Kpi icon={DollarSign} label="Ticket médio" value={fmtBRL(kpis.ticket_avg)} />
      </div>

      <div className="card-elevated p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground">Custo por crédito (R$)</label>
          <input type="number" step="0.01" value={costInput} onChange={(e) => setCostInput(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-card text-foreground text-sm" />
        </div>
        <button onClick={saveCost} disabled={savingCost} className="px-4 py-2 rounded-lg btn-primary-gradient text-sm font-semibold disabled:opacity-60">
          {savingCost ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar e recalcular"}
        </button>
      </div>

      <div className="card-elevated p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Últimos 30 dias</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => fmtBRL(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="revenue" name="Receita" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cost" name="Custo" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" name="Lucro" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Por revendedor (acumulado)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Revendedor</th>
                <th className="text-right px-4 py-3">Recargas</th>
                <th className="text-right px-4 py-3">Créditos</th>
                <th className="text-right px-4 py-3">Receita</th>
                <th className="text-right px-4 py-3">Custo</th>
                <th className="text-right px-4 py-3">Lucro</th>
                <th className="text-right px-4 py-3">Margem</th>
              </tr>
            </thead>
            <tbody>
              {perReseller.map((r) => (
                <tr key={r.warez_username} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs text-foreground">{r.warez_username}</td>
                  <td className="px-4 py-2 text-right text-foreground">{r.count}</td>
                  <td className="px-4 py-2 text-right text-foreground">{r.credits}</td>
                  <td className="px-4 py-2 text-right text-foreground">{fmtBRL(r.revenue)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{fmtBRL(r.cost)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${r.profit > 0 ? "text-green-500" : r.profit < 0 ? "text-destructive" : "text-foreground"}`}>{fmtBRL(r.profit)}</td>
                  <td className="px-4 py-2 text-right text-foreground">{r.margin.toFixed(1)}%</td>
                </tr>
              ))}
              {perReseller.length === 0 && (
                <tr><td colSpan={7} className="text-center text-sm text-muted-foreground py-8">Sem recargas confirmadas ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, positive }: { icon: typeof DollarSign; label: string; value: string; positive?: boolean }) {
  return (
    <div className="card-elevated p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`text-xl font-bold ${positive ? "text-green-500" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
