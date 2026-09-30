import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, TicketPercent, Copy } from "lucide-react";
import { formatCurrency } from "@/lib/format";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Code {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_uses: number | null;
  valid_until: string | null;
  one_per_customer: boolean;
  is_active: boolean;
  notes: string | null;
  uses: number;
  total_discount: number;
}

async function call(action: string, body?: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/discount-codes?action=${action}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "x-admin-password": sessionStorage.getItem("admin_password") || "",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Erro ${r.status}`);
  return data;
}

const empty = { code: "", discount_type: "percent" as "percent" | "fixed", discount_value: "10", max_uses: "", valid_until: "", one_per_customer: true, notes: "" };

export default function DiscountCodesTab() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => {
    setLoading(true);
    try { setCodes((await call("list")).codes || []); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setSaving(true);
    try {
      await call("create", {
        code: form.code,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value.replace(",", ".")),
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        valid_until: form.valid_until ? `${form.valid_until}T23:59:59-03:00` : null,
        one_per_customer: form.one_per_customer,
        notes: form.notes,
      });
      toast.success("Cupom criado!");
      setForm(empty);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    setSaving(false);
  };

  const toggle = async (c: Code) => {
    try { await call("toggle", { id: c.id, is_active: !c.is_active }); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };
  const remove = async (c: Code) => {
    if (!confirm(`Excluir o cupom ${c.code}?`)) return;
    try { await call("delete", { id: c.id }); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  const input = "h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary";

  return (
    <div className="space-y-6">
      <div className="card-elevated p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TicketPercent className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-foreground">Novo cupom</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="space-y-1 text-xs text-muted-foreground">Código
            <input className={`${input} w-full uppercase font-semibold`} value={form.code} placeholder="EX: VOLTA10"
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 30) })} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">Tipo
            <select className={`${input} w-full`} value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as "percent" | "fixed" })}>
              <option value="percent">Porcentagem (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">{form.discount_type === "percent" ? "Desconto (%)" : "Desconto (R$)"}
            <input className={`${input} w-full`} inputMode="decimal" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">Limite de usos (vazio = sem limite)
            <input className={`${input} w-full`} inputMode="numeric" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value.replace(/\D/g, "") })} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">Válido até (vazio = sem validade)
            <input type="date" className={`${input} w-full`} value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">Observação
            <input className={`${input} w-full`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={form.one_per_customer} onChange={(e) => setForm({ ...form, one_per_customer: e.target.checked })} />
          1 uso por cliente
        </label>
        <button onClick={create} disabled={saving || form.code.length < 3} className="btn-primary-gradient px-5 h-10 rounded-lg text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar cupom
        </button>
        <p className="text-[11px] text-muted-foreground">O uso só conta quando o PIX é pago. O cupom vale no PIX da área do cliente e do link de renovação.</p>
      </div>

      <div className="card-elevated p-5">
        <h2 className="font-bold text-foreground mb-3">Cupons</h2>
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cupom criado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground text-left">
                <tr><th className="py-2 pr-3">Código</th><th className="pr-3">Desconto</th><th className="pr-3">Usos</th><th className="pr-3">Validade</th><th className="pr-3">Total dado</th><th className="pr-3">Status</th><th /></tr>
              </thead>
              <tbody>
                {codes.map((c) => {
                  const expired = c.valid_until && new Date(c.valid_until) < new Date();
                  return (
                    <tr key={c.id} className="border-t border-border">
                      <td className="py-2 pr-3 font-bold text-foreground">
                        <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copiado!"); }} className="inline-flex items-center gap-1.5">{c.code}<Copy className="h-3 w-3 text-muted-foreground" /></button>
                        {c.one_per_customer && <span className="block text-[10px] font-normal text-muted-foreground">1 por cliente</span>}
                      </td>
                      <td className="pr-3">{c.discount_type === "percent" ? `${Number(c.discount_value)}%` : formatCurrency(Number(c.discount_value))}</td>
                      <td className="pr-3 tabular-nums">{c.uses}{c.max_uses ? ` / ${c.max_uses}` : ""}</td>
                      <td className="pr-3">{c.valid_until ? new Date(c.valid_until).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="pr-3 tabular-nums">{formatCurrency(c.total_discount)}</td>
                      <td className="pr-3">
                        <button onClick={() => toggle(c)} className={`text-xs font-bold px-2 py-1 rounded-full ${c.is_active && !expired ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                          {expired ? "Expirado" : c.is_active ? "Ativo" : "Pausado"}
                        </button>
                      </td>
                      <td className="text-right"><button onClick={() => remove(c)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
