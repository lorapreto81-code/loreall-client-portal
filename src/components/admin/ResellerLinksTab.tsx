import { useEffect, useState } from "react";
import { resellerAdmin } from "@/lib/resellerAdmin";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Copy, ExternalLink, Link2 } from "lucide-react";

interface Link {
  id: string;
  slug: string;
  display_name: string;
  warez_username: string;
  warez_user_id: number;
  whatsapp: string | null;
  email: string | null;
  credits: number;
  amount: number;
  price_per_credit: number;
  min_credits: number;
  max_credits: number;
  is_active: boolean;
  notes: string | null;
}

const empty = {
  slug: "",
  display_name: "",
  warez_username: "",
  warez_user_id: "",
  whatsapp: "",
  price_per_credit: "11",
  min_credits: "10",
  max_credits: "30",
  is_active: true,
  notes: "",
};

export default function ResellerLinksTab() {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Link | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<typeof empty>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { links } = await resellerAdmin.listLinks();
      setLinks(links);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setShowForm(true);
  };
  const openEdit = (l: Link) => {
    setEditing(l);
    setForm({
      slug: l.slug,
      display_name: l.display_name,
      warez_username: l.warez_username,
      warez_user_id: String(l.warez_user_id),
      price_per_credit: String(l.price_per_credit ?? 11),
      min_credits: String(l.min_credits ?? 10),
      max_credits: String(l.max_credits ?? 30),
      whatsapp: l.whatsapp || "",
      is_active: l.is_active,
      notes: l.notes || "",
    });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const price = Number(form.price_per_credit);
      const minC = Number(form.min_credits);
      const maxC = Number(form.max_credits);
      const payload = {
        slug: form.slug || form.display_name,
        display_name: form.display_name,
        warez_username: form.warez_username,
        warez_user_id: Number(form.warez_user_id),
        whatsapp: form.whatsapp || null,
        price_per_credit: price,
        min_credits: minC,
        max_credits: maxC,
        credits: minC,
        amount: Number((minC * price).toFixed(2)),
        is_active: form.is_active,
        notes: form.notes,
      };
      if (editing) {
        await resellerAdmin.updateLink({ id: editing.id, ...payload });
        toast.success("Atualizado");
      } else {
        await resellerAdmin.createLink(payload);
        toast.success("Criado");
      }
      setShowForm(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
    setSaving(false);
  };

  const toggle = async (l: Link) => {
    try {
      await resellerAdmin.updateLink({ id: l.id, is_active: !l.is_active });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const remove = async (l: Link) => {
    if (!confirm(`Excluir revendedor ${l.display_name}?`)) return;
    try {
      await resellerAdmin.deleteLink(l.id);
      toast.success("Excluído");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const PUBLIC_BASE_URL = "https://cliente.loreallplay.com";

  const copyLink = (slug: string) => {
    const url = `${PUBLIC_BASE_URL}/revendedor/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/30 p-4 rounded-2xl border border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Gestão de Revendedores</h2>
            <p className="text-xs text-muted-foreground">Configure links, preços e credenciais de acesso</p>
          </div>
        </div>
        <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl btn-primary-gradient text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
          <Plus className="h-4 w-4" /> Novo Revendedor
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card/20 rounded-2xl border border-dashed border-border/50">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground animate-pulse">Carregando base de revendedores...</p>
        </div>
      ) : (
        <div className="card-elevated overflow-hidden border border-border/50 rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Revendedor</th>
                  <th className="text-left px-4 py-3">Painel</th>
                  <th className="text-right px-4 py-3">R$/crédito</th>
                  <th className="text-right px-4 py-3">Mín/Máx</th>
                  <th className="text-center px-4 py-3">Ativo</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{l.display_name}</div>
                      <a href={`${PUBLIC_BASE_URL}/revendedor/${l.slug}`} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
                        cliente.loreallplay.com/revendedor/{l.slug} <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-foreground">{l.warez_username}</div>
                      <div className="text-xs text-muted-foreground">ID {l.warez_user_id}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      {Number(l.price_per_credit ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      {l.min_credits ?? 10} – {l.max_credits ?? 30}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggle(l)} className={`px-2 py-1 rounded-full text-xs font-medium ${l.is_active ? "bg-green-500/15 text-green-500" : "bg-muted text-muted-foreground"}`}>
                        {l.is_active ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => copyLink(l.slug)} className="p-1.5 rounded hover:bg-muted" title="Copiar link"><Copy className="h-4 w-4" /></button>
                        <button onClick={() => openEdit(l)} className="p-1.5 rounded hover:bg-muted" title="Editar"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(l)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {links.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-sm text-muted-foreground py-8">Nenhum revendedor cadastrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="card-elevated p-6 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground">{editing ? "Editar" : "Novo"} revendedor</h3>
            <Field label="Nome de exibição" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
            <Field label="Slug (URL)" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} placeholder="auto se vazio" />
            <Field label="Usuário WAREZ" value={form.warez_username} onChange={(v) => setForm({ ...form, warez_username: v })} />
            <Field label="ID WAREZ" value={form.warez_user_id} onChange={(v) => setForm({ ...form, warez_user_id: v })} type="number" />
            <Field label="WhatsApp (Autenticação)" value={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: v })} placeholder="Ex: 5583999998888" />
            <div className="grid grid-cols-3 gap-3">
              <Field label="R$/crédito" value={form.price_per_credit} onChange={(v) => setForm({ ...form, price_per_credit: v })} type="number" />
              <Field label="Mín. créditos" value={form.min_credits} onChange={(v) => setForm({ ...form, min_credits: v })} type="number" />
              <Field label="Máx. créditos" value={form.max_credits} onChange={(v) => setForm({ ...form, max_credits: v })} type="number" />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Ativo
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border border-border text-sm">Cancelar</button>
              <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-lg btn-primary-gradient text-sm font-semibold disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-card text-foreground text-sm"
      />
    </div>
  );
}
