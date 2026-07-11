import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, Gift, CheckCircle2, MessageCircle, ArrowLeft, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { lookupReferralCode } from "@/lib/api";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const logo = "/logo.png";

interface PublicConfig {
  enabled: boolean;
  days: number;
  telas: number;
  support_whatsapp: string;
}

interface PendingResult {
  signup_id: string;
  trial_days: number;
  support_whatsapp: string;
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");

const formatPhone = (raw: string) => {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const IndicacaoTeste = () => {
  const { code: codeParam } = useParams<{ code: string }>();
  const code = (codeParam || "").trim().toUpperCase();

  const [checking, setChecking] = useState(true);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [invalid, setInvalid] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PendingResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [lookup, cfgRes] = await Promise.all([
          lookupReferralCode(code),
          fetch(`${SUPABASE_URL}/functions/v1/referrals-api?action=get-trial-config-public`, {
            headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
          }).then((r) => r.json()),
        ]);
        if (!lookup?.valid) {
          setInvalid(true);
        } else {
          setReferrerName(lookup.customer_name || `Cliente #${lookup.customer_id}`);
        }
        setConfig(cfgRes as PublicConfig);
      } catch {
        setInvalid(true);
      }
      setChecking(false);
    })();
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const phoneDigits = onlyDigits(phone);
    if (name.trim().length < 2) {
      toast.error("Informe seu nome completo");
      return;
    }
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      toast.error("WhatsApp inválido — use DDD + número");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/referrals-api?action=create-trial`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ code, name: name.trim(), whatsapp: phoneDigits }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data?.already_exists && data?.support_whatsapp) {
          toast.error(data.error || "WhatsApp já cadastrado");
          openSupport(data.support_whatsapp, `Oi! Tentei criar um teste pela indicação ${code} mas meu WhatsApp já está cadastrado. Pode me ajudar?`);
        } else {
          toast.error(data?.error || "Erro ao criar teste");
        }
        return;
      }
      const pending = data as PendingResult;
      setResult(pending);

      // Auto-abre WhatsApp de suporte com os dados do cliente para a equipe já ser notificada
      const supportMsg =
        `Olá! 👋 Acabei de me cadastrar pelo link de indicação e quero ativar meu *teste grátis* na *Loreall Play TV*.\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📛 *Nome:* ${name.trim()}\n` +
        `📱 *WhatsApp:* ${formatPhone(phone)}\n` +
        `🎁 *Indicado por:* ${referrerName || "—"}\n` +
        `🔖 *Código:* ${code}\n` +
        `🎫 *Protocolo:* ${pending.signup_id.slice(0, 8).toUpperCase()}\n` +
        `📅 *Teste:* ${pending.trial_days} dia(s)\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `Aguardo o envio do meu usuário e senha 🙌`;
      if (pending.support_whatsapp) {
        openSupport(pending.support_whatsapp, supportMsg);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  const openSupport = (waNumber: string, message: string) => {
    const num = onlyDigits(waNumber);
    if (!num) {
      toast.error("WhatsApp do suporte não configurado");
      return;
    }
    const url = `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener");
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="card-elevated p-8 w-full max-w-sm text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Link inválido</h1>
          <p className="text-sm text-muted-foreground">
            Este código de indicação não existe ou expirou. Peça um novo link para quem te indicou.
          </p>
          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Ir para login
          </Link>
        </div>
      </div>
    );
  }

  if (result) {
    const supportMsg =
      `Olá! 👋 Acabei de me cadastrar pelo link de indicação e quero ativar meu *teste grátis* na *Loreall Play TV*.\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📛 *Nome:* ${name.trim()}\n` +
      `📱 *WhatsApp:* ${formatPhone(phone)}\n` +
      `🎁 *Indicado por:* ${referrerName || "—"}\n` +
      `🔖 *Código:* ${code}\n` +
      `🎫 *Protocolo:* ${result.signup_id.slice(0, 8).toUpperCase()}\n` +
      `📅 *Teste:* ${result.trial_days} dia(s)\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `Aguardo o envio do meu usuário e senha 🙌`;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
        <div className="card-elevated p-6 w-full max-w-md space-y-5">
          <div className="text-center space-y-3">
            <div className="relative inline-flex">
              <MessageCircle className="h-14 w-14 text-primary" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-primary" />
              </span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Abrimos o WhatsApp pra você!</h1>
            <p className="text-sm text-muted-foreground">
              Envie a mensagem que já preenchemos e nossa equipe libera seu <strong className="text-foreground">usuário e senha</strong> em instantes.
            </p>
          </div>

          <div className="bg-muted/40 border border-border rounded-lg p-4 space-y-2 text-sm">
            <Row label="Protocolo" value={result.signup_id.slice(0, 8).toUpperCase()} mono />
            <Row label="Nome" value={name} />
            <Row label="WhatsApp" value={formatPhone(phone)} />
            <Row label="Teste liberado" value={`${result.trial_days} dia(s)`} />
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Não abriu o WhatsApp?</p>
              <p>Alguns navegadores bloqueiam a abertura automática. Toque no botão abaixo para abrir manualmente.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openSupport(result.support_whatsapp, supportMsg)}
            className="w-full py-3 btn-primary-gradient font-semibold text-sm inline-flex items-center justify-center gap-2"
            disabled={!result.support_whatsapp}
          >
            <MessageCircle className="h-4 w-4" /> Abrir WhatsApp do suporte
          </button>
          {!result.support_whatsapp && (
            <p className="text-xs text-destructive text-center">
              WhatsApp do suporte não configurado. Avise o administrador.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="card-elevated p-6 w-full max-w-md space-y-5">
        <div className="flex justify-center">
          <img src={logo} alt="Logo" className="h-12 w-auto" />
        </div>

        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Gift className="h-3.5 w-3.5" /> Você foi indicado!
          </div>
          <h1 className="text-xl font-bold text-foreground">
            <span className="text-primary">{referrerName}</span> está te indicando
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastre-se e ganhe <strong className="text-foreground">{config?.days || 1} dia(s) de teste grátis</strong> com {config?.telas || 1} tela.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Seu nome completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Ex: João da Silva"
              required
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Seu WhatsApp</label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="(11) 99999-9999"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !config?.enabled}
            className="w-full py-3 btn-primary-gradient font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            {submitting ? "Criando..." : "Quero meu teste grátis"}
          </button>

          {config && !config.enabled && (
            <p className="text-xs text-destructive text-center">
              Cadastro de teste temporariamente desativado.
            </p>
          )}
        </form>

        <p className="text-xs text-muted-foreground text-center">
          Já tem cadastro?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
};

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={`text-sm font-semibold text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
  </div>
);

export default IndicacaoTeste;
