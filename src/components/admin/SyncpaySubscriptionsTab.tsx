import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Repeat, Archive, RefreshCw, Users, ExternalLink, Copy, Check, X, Zap, QrCode } from "lucide-react";
import { syncpayAdmin, SyncpayPlan } from "@/lib/resellerAdmin";
import { formatCurrency } from "@/lib/format";
import { getPlans } from "@/lib/api";
import { Plan, getPlanName, getPlanValue } from "@/lib/planUtils";

export default function SyncpaySubscriptionsTab() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SyncpayPlan[]>([]);
  const [tgPlans, setTgPlans] = useState<Plan[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [subsFor, setSubsFor] = useState<SyncpayPlan | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [{ plans }, tg] = await Promise.all([
        syncpayAdmin.listPlans(),
        getPlans().catch((err) => {
          console.error("[SyncpaySubscriptionsTab] Error loading TG plans:", err);
          return { data: [] as Plan[] };
        }),
      ]);
      setPlans(plans || []);
      const tgList = Array.isArray(tg) ? tg : (tg?.data || tg?.plans || tg?.list || tg || []);
      console.log("[SyncpaySubscriptionsTab] TG Response:", tg);
      console.log("[SyncpaySubscriptionsTab] Normalized TG List:", tgList);
      
      if (tgList.length === 0) {
        console.warn("[SyncpaySubscriptionsTab] No plans found in TG list.");
      }
      
      setTgPlans(tgList);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const sync = async () => {
    setBusy(true);
    try {
      const r = await syncpayAdmin.syncPlans();
      toast.success(`${r.synced} plano(s) sincronizado(s)`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
    setBusy(false);
  };

  const archive = async (p: SyncpayPlan) => {
    if (!confirm(`Arquivar o plano "${p.name}"?`)) return;
    setBusy(true);
    try {
      await syncpayAdmin.archivePlan(p.id);
      toast.success("Plano arquivado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
    setBusy(false);
  };

  const setTgMap = async (p: SyncpayPlan, tgId: string) => {
    try {
      await syncpayAdmin.updatePlan({ id: p.id, topgestor_plan_id: tgId ? Number(tgId) : null });
      setPlans((prev) => prev.map((x) => x.id === p.id ? { ...x, topgestor_plan_id: tgId ? Number(tgId) : null } : x));
      toast.success("Mapeamento salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const copyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Assinaturas (Recorrência)</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">todos os planos da Top gestor (Total TopGestor: {tgPlans.length})</p>
        </div>
        <div className="flex gap-2">
          <button onClick={sync} disabled={busy} className="px-3 py-2 rounded-lg border border-input text-sm inline-flex items-center gap-1.5 hover:bg-muted disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> Sincronizar
          </button>
          <button onClick={() => setShowCreate(true)} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Novo plano
          </button>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="card-elevated p-8 text-center text-sm text-muted-foreground">
          Nenhum plano criado ainda. Clique em <b>Novo plano</b> ou <b>Sincronizar</b> para trazer os que já existem no SyncPay.
        </div>
      ) : (
        <div className="grid gap-3">
          {plans.map((p) => (
            <div key={p.id} className="card-elevated p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{p.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.status === "active" ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"}`}>{p.status}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary inline-flex items-center gap-1">
                      {p.billing_method === "pix_automatico" ? <><Zap className="h-3 w-3" /> PIX Automático</> : <><QrCode className="h-3 w-3" /> QR por ciclo</>}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-foreground mt-1">{formatCurrency(Number(p.amount))} <span className="text-xs font-normal text-muted-foreground">/ {p.periodicity_days}d</span></div>
                  {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setSubsFor(p)} className="p-2 rounded-lg border border-input hover:bg-muted" title="Ver assinantes">
                    <Users className="h-4 w-4" />
                  </button>
                  <button onClick={() => archive(p)} className="p-2 rounded-lg border border-input hover:bg-destructive/10 hover:text-destructive" title="Arquivar">
                    <Archive className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div>
                  <label className="text-[11px] text-muted-foreground">Renovar no TopGestor com plano</label>
                  <select
                    value={p.topgestor_plan_id || ""}
                    onChange={(e) => setTgMap(p, e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 rounded-md border border-input bg-card text-sm"
                  >
                    <option value="">— Não mapeado —</option>
                    {tgPlans.map((tp) => (
                      <option key={tp.id} value={tp.id}>
                        #{tp.id} - {getPlanName(tp)} ({formatCurrency(getPlanValue(tp))})
                      </option>
                    ))}
                  </select>
                </div>
                {p.checkout_url && (
                  <div>
                    <label className="text-[11px] text-muted-foreground">Link de checkout público</label>
                    <div className="flex gap-1.5 mt-1">
                      <input readOnly value={p.checkout_url} className="flex-1 px-2 py-1.5 rounded-md border border-input bg-muted/40 text-xs font-mono" />
                      <button onClick={() => copyUrl(p.checkout_url!, p.id)} className="px-2 rounded-md border border-input hover:bg-muted">
                        {copiedId === p.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <a href={p.checkout_url} target="_blank" rel="noreferrer" className="px-2 rounded-md border border-input hover:bg-muted inline-flex items-center">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreatePlanModal tgPlans={tgPlans} onClose={() => setShowCreate(false)} onCreated={load} />}
      {subsFor && <SubscribersModal plan={subsFor} onClose={() => setSubsFor(null)} />}
    </div>
  );
}

function CreatePlanModal({ tgPlans, onClose, onCreated }: { tgPlans: Plan[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [periodicity, setPeriodicity] = useState("30");
  const [method, setMethod] = useState<"qr_code" | "pix_automatico">("qr_code");
  const [tgId, setTgId] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name || !amount) return toast.error("Nome e valor são obrigatórios");
    setSaving(true);
    try {
      await syncpayAdmin.createPlan({
        name, description, amount: Number(amount),
        periodicity_days: Number(periodicity),
        billing_method: method,
        topgestor_plan_id: tgId ? Number(tgId) : undefined,
      });
      toast.success("Plano criado no SyncPay");
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-card w-full max-w-md rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold">Novo plano de assinatura</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <Field label="Nome"><input value={name} onChange={(e) => setName(e.target.value)} className="input-base" placeholder="Plano Mensal Premium" /></Field>
          <Field label="Descrição (opcional)"><input value={description} onChange={(e) => setDescription(e.target.value)} className="input-base" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Valor (R$ inteiro)"><input type="number" step="1" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-base" placeholder="50" /></Field>
            <Field label="Ciclo (dias)"><input type="number" value={periodicity} onChange={(e) => setPeriodicity(e.target.value)} className="input-base" /></Field>
          </div>
          <Field label="Método de cobrança">
            <div className="grid grid-cols-2 gap-2">
              {(["qr_code", "pix_automatico"] as const).map((m) => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`p-2 rounded-lg border-2 text-xs text-left ${method === m ? "border-primary bg-primary/5" : "border-input"}`}>
                  <div className="font-semibold text-foreground inline-flex items-center gap-1">
                    {m === "pix_automatico" ? <><Zap className="h-3 w-3" /> PIX Automático</> : <><QrCode className="h-3 w-3" /> QR por ciclo</>}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {m === "pix_automatico" ? "Débito em conta autorizado 1x" : "QR novo por e-mail a cada ciclo"}
                  </div>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Plano TopGestor para renovar (opcional)">
            <select value={tgId} onChange={(e) => setTgId(e.target.value)} className="input-base">
              <option value="">— Não mapear agora —</option>
              {tgPlans.map((p) => (
                <option key={p.id} value={p.id}>{getPlanName(p)} — {formatCurrency(getPlanValue(p))}</option>
              ))}
            </select>
          </Field>
        </div>
        <button onClick={save} disabled={saving} className="w-full mt-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Criar plano
        </button>
      </div>
    </div>
  );
}

function SubscribersModal({ plan, onClose }: { plan: SyncpayPlan; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await syncpayAdmin.listSubscribers(plan.syncpay_plan_id);
        setSubs(r.subscribers || r.local || []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro");
      }
      setLoading(false);
    })();
  }, [plan]);

  const cancel = async (id: string) => {
    if (!confirm("Cancelar esta assinatura?")) return;
    try {
      await syncpayAdmin.cancelSubscription(id);
      toast.success("Cancelada");
      setSubs((prev) => prev.map((s) => (s.id === id || s.token === id) ? { ...s, status: "cancelled" } : s));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-card w-full max-w-2xl rounded-2xl p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold">Assinantes — {plan.name}</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : subs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum assinante ainda.</p>
        ) : (
          <div className="divide-y divide-border">
            {subs.map((s: any, i: number) => {
              const id = s.id || s.token || s.syncpay_subscription_id;
              return (
                <div key={id || i} className="py-3 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{s.customer_name || s.customer?.name || s.name || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.customer_email || s.customer?.email || s.email || "—"}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Status: <b>{s.status || "—"}</b>
                      {s.next_charge_at && <> · próxima: {new Date(s.next_charge_at).toLocaleDateString("pt-BR")}</>}
                    </div>
                  </div>
                  {s.status !== "cancelled" && id && (
                    <button onClick={() => cancel(id)} className="text-xs px-2 py-1 rounded border border-input hover:bg-destructive/10 hover:text-destructive">
                      Cancelar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
