import { useEffect, useState } from "react";
import { resellerAdmin } from "@/lib/resellerAdmin";
import { toast } from "sonner";
import { Loader2, Save, Zap, Users, ServerCog, Copy, Check, ArrowLeftRight } from "lucide-react";

type Provider = "fastdepix" | "syncpay";

const PROVIDERS: { id: Provider; label: string; short: string; color: string; paused?: boolean }[] = [
  { id: "syncpay", label: "SyncPay", short: "SP", color: "from-indigo-500 to-purple-600" },
  { id: "fastdepix", label: "Fast Depix", short: "FD", color: "from-emerald-500 to-teal-600", paused: true },
];

export default function PixProviderTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Provider>("fastdepix");
  const [resellers, setResellers] = useState<Provider>("fastdepix");
  const [syncpayUrl, setSyncpayUrl] = useState("https://api.syncpayments.com.br");
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/syncpay-webhook`;

  const load = async () => {
    setLoading(true);
    try {
      const { config } = await resellerAdmin.getConfig();
      setCustomers((config.pix_provider_customers as Provider) || "fastdepix");
      setResellers((config.pix_provider_resellers as Provider) || "fastdepix");
      setSyncpayUrl(config.syncpay_api_url || "https://api.syncpayments.com.br");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const updateOne = async (key: string, value: string) => {
    setSaving(true);
    try {
      await resellerAdmin.updateConfig({ [key]: value });
      toast.success("Provedor atualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
      await load();
    }
    setSaving(false);
  };

  const saveUrl = async () => {
    setSaving(true);
    try {
      await resellerAdmin.updateConfig({ syncpay_api_url: syncpayUrl.trim() });
      toast.success("URL salva");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
    setSaving(false);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground">Provedor PIX</h2>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-sm text-muted-foreground">
        Escolha qual provedor processa cada tipo de cobrança. A troca é imediata — as próximas cobranças vão pelo provedor selecionado.
      </p>

      <ProviderCard
        icon={<Users className="h-4 w-4" />}
        title="Clientes (renovações)"
        description="PIX gerado quando um cliente renova o acesso na página principal."
        value={customers}
        onChange={(v) => { setCustomers(v); updateOne("pix_provider_customers", v); }}
      />

      <ProviderCard
        icon={<Zap className="h-4 w-4" />}
        title="Revendedores (recargas)"
        description="PIX gerado quando um revendedor compra créditos pelo link personalizado."
        value={resellers}
        onChange={(v) => { setResellers(v); updateOne("pix_provider_resellers", v); }}
      />

      <div className="card-elevated p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ServerCog className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Configuração SyncPay</h3>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">URL base da API SyncPay</label>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              value={syncpayUrl}
              onChange={(e) => setSyncpayUrl(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-input bg-card text-foreground text-sm font-mono"
            />
            <button onClick={saveUrl} disabled={saving} className="px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
              <Save className="h-3.5 w-3.5" /> Salvar
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Padrão: https://api.syncpayments.com.br</p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Webhook URL (configure no painel SyncPay)</label>
          <div className="flex gap-2 mt-1">
            <input readOnly value={webhookUrl} className="flex-1 px-3 py-2 rounded-lg border border-input bg-muted/40 text-foreground text-xs font-mono" />
            <button onClick={copy} className="px-4 rounded-lg border border-input bg-card text-sm inline-flex items-center gap-1.5 hover:bg-muted">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Cole este endereço no SyncPay como webhook de cashin (onCreate/onUpdate).</p>
        </div>
        <div className="text-[11px] text-muted-foreground p-3 rounded-lg bg-muted/40 leading-relaxed">
          💡 As credenciais <code className="text-foreground font-mono">SYNCPAY_CLIENT_ID</code> e <code className="text-foreground font-mono">SYNCPAY_CLIENT_SECRET</code> são gerenciadas como secrets do sistema (não aparecem aqui). Para trocar, vá em <span className="text-foreground">Backend → Secrets</span>.
        </div>
      </div>
    </div>
  );
}

function ProviderCard({
  icon, title, description, value, onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: Provider;
  onChange: (v: Provider) => void;
}) {
  return (
    <div className="card-elevated p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
            {icon} {title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {PROVIDERS.map((p) => {
          const active = value === p.id;
          return (
            <button
              key={p.id}
              onClick={() => !active && onChange(p.id)}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                active
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-input bg-card hover:border-muted-foreground/40"
              }`}
            >
              <div className={`inline-flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br ${p.color} text-white text-xs font-bold mb-2`}>
                {p.short}
              </div>
              <div className="text-sm font-semibold text-foreground">{p.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {active ? "✓ Em uso" : "Tocar para ativar"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
