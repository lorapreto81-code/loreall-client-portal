import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Gift, Copy, ExternalLink } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface TrialConfig {
  trial_enabled: string;
  trial_product_id: string;
  trial_plan_id: string;
  trial_telas: string;
  trial_days: string;
  trial_support_whatsapp: string;
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");

async function call(action: string, opts: { method?: string; body?: Record<string, unknown> } = {}) {
  const pwd = sessionStorage.getItem("admin_password") || "";
  const r = await fetch(`${SUPABASE_URL}/functions/v1/referrals-api?action=${action}`, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "x-admin-password": pwd,
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Erro ${r.status}`);
  return data;
}

export default function ReferralTrialConfigTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<TrialConfig>({
    trial_enabled: "true",
    trial_product_id: "",
    trial_plan_id: "",
    trial_telas: "1",
    trial_days: "1",
    trial_support_whatsapp: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const { config } = await call("get-trial-config");
      setCfg(config);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const entries = { ...cfg, trial_support_whatsapp: onlyDigits(cfg.trial_support_whatsapp) };
      await call("update-trial-config", { method: "POST", body: { entries } });
      toast.success("Configurações salvas");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
    setSaving(false);
  };

  const set = (k: keyof TrialConfig, v: string) => setCfg((c) => ({ ...c, [k]: v }));

  const sampleLink = `${window.location.origin}/indicacao/ABC123`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl md:max-w-4xl mx-auto space-y-4 px-2 sm:px-0">
      <h2 className="text-xl font-bold text-foreground inline-flex items-center gap-2">
        <Gift className="h-5 w-5" /> Teste grátis por indicação
      </h2>

      <div className="card-elevated p-4 text-xs text-muted-foreground space-y-2">
        <p>
          Quando o indicador compartilhar o link <code className="px-1 py-0.5 rounded bg-muted text-foreground">/indicacao/CODIGO</code>,
          o indicado preenche nome + WhatsApp e o sistema cria automaticamente um cadastro de teste no TopGestor já vinculado à indicação.
        </p>
        <p>
          Quando esse cliente renovar (PIX ou marcação manual no admin), o bônus de +30 dias cai automático no indicador.
        </p>
        <div className="flex items-center gap-2 pt-2">
          <code className="flex-1 px-2 py-1.5 rounded bg-muted text-foreground text-[11px] truncate">{sampleLink}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(sampleLink); toast.success("Link de exemplo copiado"); }}
            className="p-1.5 rounded hover:bg-muted"
            title="Copiar exemplo"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <a href={sampleLink.replace("ABC123", "ABCXYZ")} target="_blank" rel="noopener" className="p-1.5 rounded hover:bg-muted" title="Abrir exemplo">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-elevated p-5 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Sistema de teste ativo</p>
            <p className="text-xs text-muted-foreground">Desative para parar de aceitar novos cadastros pela página de indicação.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={cfg.trial_enabled !== "false"}
              onChange={(e) => set("trial_enabled", e.target.checked ? "true" : "false")}
            />
            <div className="w-11 h-6 bg-muted peer-checked:bg-primary rounded-full transition" />
            <div className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition ${cfg.trial_enabled !== "false" ? "translate-x-5" : ""}`} />
          </label>
        </div>

        <Field
          label="Product ID (servidor)"
          hint="ID do produto/servidor no TopGestor que será usado pro teste (ex: Uniplay). Pegue em Produtos → editar."
          value={cfg.trial_product_id}
          onChange={(v) => set("trial_product_id", onlyDigits(v))}
          placeholder="123"
        />
        <Field
          label="Plan ID"
          hint="ID do plano no TopGestor que será atribuído (geralmente um plano mensal barato — vai virar pago na renovação)."
          value={cfg.trial_plan_id}
          onChange={(v) => set("trial_plan_id", onlyDigits(v))}
          placeholder="456"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Telas"
            value={cfg.trial_telas}
            onChange={(v) => set("trial_telas", onlyDigits(v) || "1")}
            placeholder="1"
          />
          <Field
            label="Dias de teste"
            value={cfg.trial_days}
            onChange={(v) => set("trial_days", onlyDigits(v) || "1")}
            placeholder="1"
          />
        </div>
        <Field
          label="WhatsApp do suporte"
          hint="Com DDI + DDD. Ex: 5511999998888 — usado no botão 'Falar com suporte' após o cadastro."
          value={cfg.trial_support_whatsapp}
          onChange={(v) => set("trial_support_whatsapp", onlyDigits(v))}
          placeholder="5511999998888"
        />

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3 btn-primary-gradient font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Salvando..." : "Salvar configurações"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, value, onChange, placeholder }: { label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
