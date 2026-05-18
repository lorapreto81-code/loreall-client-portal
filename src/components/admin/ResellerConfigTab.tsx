import { useEffect, useState } from "react";
import { resellerAdmin } from "@/lib/resellerAdmin";
import { toast } from "sonner";
import { Loader2, Save, ServerCog } from "lucide-react";

export default function ResellerConfigTab() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { config } = await resellerAdmin.getConfig();
      setConfig(config);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await resellerAdmin.updateConfig(config);
      toast.success("Configurações salvas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
    setSaving(false);
  };

  const set = (k: string, v: string) => setConfig((c) => ({ ...c, [k]: v }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-xl font-bold text-foreground inline-flex items-center gap-2">
        <ServerCog className="h-5 w-5" /> Configurações do sistema
      </h2>

      <div className="card-elevated p-6 space-y-4">
        <Field
          label="URL da API WAREZ/WPainel"
          hint="Base URL oficial: https://mcapi.knewcms.com:2087"
          value={config.warez_api_url || ""}
          onChange={(v) => set("warez_api_url", v)}
        />
        <Field
          label="Token estático WAREZ"
          hint="Bearer token usado no PATCH /users/credits/{id}"
          value={config.warez_api_token || ""}
          onChange={(v) => set("warez_api_token", v)}
          type="password"
        />
        <Field
          label="Custo por crédito (R$)"
          hint="Usado para calcular o lucro no dashboard"
          value={config.credit_cost_brl || ""}
          onChange={(v) => set("credit_cost_brl", v)}
          type="number"
        />

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3 btn-primary-gradient text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configurações
        </button>
      </div>

      <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/40">
        💡 O token nunca é exposto no frontend público. Apenas o admin autenticado vê e edita.
      </div>
    </div>
  );
}

function Field({ label, hint, value, onChange, type = "text" }: { label: string; hint?: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground">{label}</label>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-2 px-3 py-2 rounded-lg border border-input bg-card text-foreground text-sm font-mono"
      />
    </div>
  );
}
