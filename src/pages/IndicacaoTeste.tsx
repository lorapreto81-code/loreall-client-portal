import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Loader2,
  Gift,
  CheckCircle2,
  MessageCircle,
  ArrowLeft,
  AlertCircle,
  ShieldCheck,
  Clock,
  Sparkles,
  User as UserIcon,
  Phone,
  KeyRound,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { lookupReferralCode } from "@/lib/api";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const logo = "/logo.png";

// Design tokens — mesma paleta clara ("Cards macios") de Links.tsx
const BG = "#fafbfc";
const SURFACE = "#ffffff";
const BORDER = "#e8ecf1";
const TEXT = "#0f172a";
const MUTED = "#94a3b8";
const ACCENT = "#3b82f6";
const ACCENT_SOFT = "rgba(59,130,246,0.10)";

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

const pageStyle: React.CSSProperties = {
  backgroundColor: BG,
  color: TEXT,
  fontFamily: "'Figtree', system-ui, sans-serif",
};

const headingFont: React.CSSProperties = { fontFamily: "'Outfit', sans-serif" };

const IndicacaoTeste = () => {
  const { code: codeParam } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const initialCode = (codeParam || "").trim().toUpperCase();

  const [code, setCode] = useState(initialCode);
  const [manualCode, setManualCode] = useState("");
  const [checking, setChecking] = useState(!!initialCode);
  const [validating, setValidating] = useState(false);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [needsCode, setNeedsCode] = useState(!initialCode);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PendingResult | null>(null);

  // Sempre carrega config pública
  useEffect(() => {
    (async () => {
      try {
        const cfgRes = await fetch(
          `${SUPABASE_URL}/functions/v1/referrals-api?action=get-trial-config-public`,
          { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
        ).then((r) => r.json());
        setConfig(cfgRes as PublicConfig);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // Valida código quando vem via URL
  useEffect(() => {
    if (!initialCode) return;
    (async () => {
      try {
        const lookup = await lookupReferralCode(initialCode);
        if (!lookup?.valid) {
          setInvalid(true);
          setNeedsCode(true);
        } else {
          setReferrerName(lookup.customer_name || `Cliente #${lookup.customer_id}`);
          setCode(initialCode);
        }
      } catch {
        setInvalid(true);
        setNeedsCode(true);
      }
      setChecking(false);
    })();
  }, [initialCode]);

  const handleValidateManual = async () => {
    const c = manualCode.trim().toUpperCase();
    if (c.length < 3) {
      toast.error("Digite um código válido");
      return;
    }
    setValidating(true);
    try {
      const lookup = await lookupReferralCode(c);
      if (!lookup?.valid) {
        toast.error("Código não encontrado. Confira com quem te indicou.");
      } else {
        setReferrerName(lookup.customer_name || `Cliente #${lookup.customer_id}`);
        setCode(c);
        setNeedsCode(false);
        setInvalid(false);
        toast.success(`Código validado! Indicado por ${lookup.customer_name || "cliente"}.`);
      }
    } catch {
      toast.error("Erro ao validar código");
    } finally {
      setValidating(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };


  const buildSupportMessage = (pending: PendingResult) =>
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

  const openSupport = (waNumber: string, message: string) => {
    const num = onlyDigits(waNumber);
    if (!num) {
      toast.error("WhatsApp do suporte não configurado");
      return;
    }
    const url = `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener");
  };

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
          openSupport(
            data.support_whatsapp,
            `Oi! Tentei criar um teste pela indicação ${code} mas meu WhatsApp já está cadastrado. Pode me ajudar?`,
          );
        } else {
          toast.error(data?.error || "Erro ao criar teste");
        }
        return;
      }
      const pending = data as PendingResult;
      setResult(pending);
      if (pending.support_whatsapp) {
        openSupport(pending.support_whatsapp, buildSupportMessage(pending));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------------- Estados ---------------------- */

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={pageStyle}>
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: ACCENT }} />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={pageStyle}>
        <SoftCard className="w-full max-w-sm text-center space-y-4 p-8">
          <div
            className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(239,68,68,0.10)" }}
          >
            <AlertCircle className="h-7 w-7" style={{ color: "#ef4444" }} />
          </div>
          <h1 className="text-xl font-extrabold" style={headingFont}>
            Link inválido
          </h1>
          <p className="text-sm" style={{ color: MUTED }}>
            Este código de indicação não existe ou expirou. Peça um novo link para quem te indicou.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: ACCENT }}
          >
            <ArrowLeft className="h-4 w-4" /> Ir para o login
          </Link>
        </SoftCard>
      </div>
    );
  }

  if (result) {
    const supportMsg = buildSupportMessage(result);
    return (
      <div className="min-h-screen flex items-start justify-center px-4 py-10" style={pageStyle}>
        <div className="w-full max-w-[420px] flex flex-col gap-5">
          <SoftCard className="p-7 space-y-6 text-center">
            <div className="mx-auto relative inline-flex">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: ACCENT_SOFT }}
              >
                <MessageCircle className="h-8 w-8" style={{ color: ACCENT }} />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70"
                  style={{ backgroundColor: ACCENT }}
                />
                <span
                  className="relative inline-flex rounded-full h-3.5 w-3.5"
                  style={{ backgroundColor: ACCENT }}
                />
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold tracking-tight" style={headingFont}>
                Abrimos o WhatsApp!
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                Envie a mensagem que já preenchemos e nossa equipe libera seu{" "}
                <strong style={{ color: TEXT }}>usuário e senha</strong> em instantes.
              </p>
            </div>

            <div
              className="rounded-2xl p-4 space-y-2.5 text-left"
              style={{ backgroundColor: "#f7f9fc", border: `1px solid ${BORDER}` }}
            >
              <Row label="Protocolo" value={result.signup_id.slice(0, 8).toUpperCase()} mono />
              <Row label="Nome" value={name} />
              <Row label="WhatsApp" value={formatPhone(phone)} />
              <Row label="Teste liberado" value={`${result.trial_days} dia(s)`} />
            </div>

            <button
              type="button"
              onClick={() => openSupport(result.support_whatsapp, supportMsg)}
              className="w-full h-12 rounded-2xl font-bold text-sm inline-flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
              style={{ backgroundColor: ACCENT, color: "#fff" }}
              disabled={!result.support_whatsapp}
            >
              <MessageCircle className="h-4 w-4" /> Abrir WhatsApp do suporte
            </button>

            <div
              className="flex gap-3 text-left rounded-2xl p-3.5"
              style={{ backgroundColor: "#f7f9fc", border: `1px solid ${BORDER}` }}
            >
              <Clock className="h-4 w-4 mt-0.5 shrink-0" style={{ color: ACCENT }} />
              <p className="text-xs" style={{ color: MUTED }}>
                Não abriu automaticamente? Alguns navegadores bloqueiam. Toque no botão acima para
                abrir manualmente.
              </p>
            </div>
          </SoftCard>
        </div>
      </div>
    );
  }

  /* ---------------------- Formulário ---------------------- */
  return (
    <div className="min-h-screen flex items-start justify-center px-4 py-10" style={pageStyle}>
      <div className="w-full max-w-[420px] flex flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col items-center text-center gap-4">
          <div
            className="w-20 h-20 rounded-[1.75rem] flex items-center justify-center overflow-hidden"
            style={{
              backgroundColor: SURFACE,
              border: `1px solid ${BORDER}`,
              boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
            }}
          >
            <img src={logo} alt="Loreall Play TV" className="w-14 h-auto" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight" style={headingFont}>
              Loreall Play TV
            </h1>
            <p
              className="text-[10px] font-semibold tracking-[0.2em] uppercase"
              style={{ color: MUTED }}
            >
              TESTE GRÁTIS • SEM CARTÃO
            </p>
          </div>
        </header>

        {/* Card de indicação */}
        <SoftCard className="p-6 space-y-5">
          <div
            className="flex items-center gap-3 rounded-2xl p-3.5"
            style={{ backgroundColor: ACCENT_SOFT }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: ACCENT }}
            >
              <Gift className="h-5 w-5" style={{ color: "#fff" }} />
            </div>
            <div className="text-sm leading-tight">
              <p className="font-semibold" style={{ color: TEXT }}>
                Você foi indicado por{" "}
                <span style={{ color: ACCENT }}>{referrerName}</span>
              </p>
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                Ganhe {config?.days || 1} dia(s) de teste com {config?.telas || 1} tela.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <BenefitRow icon={<Sparkles className="h-4 w-4" />} text="Acesso imediato ao catálogo completo" />
            <BenefitRow icon={<ShieldCheck className="h-4 w-4" />} text="Sem cartão de crédito, sem compromisso" />
            <BenefitRow icon={<MessageCircle className="h-4 w-4" />} text="Suporte humano no WhatsApp" />
          </div>
        </SoftCard>

        {/* Formulário */}
        <SoftCard className="p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold" style={headingFont}>
              Preencha seus dados
            </h2>
            <p className="text-xs" style={{ color: MUTED }}>
              Usamos apenas para liberar seu acesso — nada de spam.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="Nome completo"
              icon={<UserIcon className="h-4 w-4" style={{ color: MUTED }} />}
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className="w-full bg-transparent outline-none text-sm font-medium"
                style={{ color: TEXT }}
                placeholder="Ex: João da Silva"
                required
              />
            </Field>

            <Field
              label="WhatsApp com DDD"
              icon={<Phone className="h-4 w-4" style={{ color: MUTED }} />}
            >
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                className="w-full bg-transparent outline-none text-sm font-medium"
                style={{ color: TEXT }}
                placeholder="(11) 99999-9999"
                required
              />
            </Field>

            <button
              type="submit"
              disabled={submitting || !config?.enabled}
              className="w-full h-12 rounded-2xl font-bold text-sm inline-flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
              style={{ backgroundColor: ACCENT, color: "#fff" }}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {submitting ? "Enviando..." : "Ativar meu teste grátis"}
            </button>

            {config && !config.enabled && (
              <p className="text-xs text-center" style={{ color: "#ef4444" }}>
                Cadastro de teste temporariamente desativado.
              </p>
            )}
          </form>

          <div className="flex items-center gap-2 justify-center pt-1">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: MUTED }} />
            <span className="text-[11px]" style={{ color: MUTED }}>
              Seus dados ficam protegidos e são usados só para ativação.
            </span>
          </div>
        </SoftCard>

        <p className="text-xs text-center" style={{ color: MUTED }}>
          Já é cliente?{" "}
          <Link to="/login" className="font-semibold" style={{ color: ACCENT }}>
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
};

/* ---------------------- UI helpers ---------------------- */

const SoftCard = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`rounded-[2rem] ${className}`}
    style={{
      backgroundColor: SURFACE,
      border: `1px solid ${BORDER}`,
      boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.04)",
    }}
  >
    {children}
  </div>
);

const Field = ({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <label className="block">
    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
      {label}
    </span>
    <div
      className="mt-1.5 flex items-center gap-2.5 h-12 px-3.5 rounded-2xl"
      style={{ backgroundColor: "#f7f9fc", border: `1px solid ${BORDER}` }}
    >
      {icon}
      {children}
    </div>
  </label>
);

const BenefitRow = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex items-center gap-3">
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
      style={{ backgroundColor: ACCENT_SOFT, color: ACCENT }}
    >
      {icon}
    </div>
    <span className="text-sm" style={{ color: TEXT }}>
      {text}
    </span>
  </div>
);

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-xs" style={{ color: MUTED }}>
      {label}
    </span>
    <span
      className={`text-sm font-bold ${mono ? "font-mono" : ""}`}
      style={{ color: TEXT }}
    >
      {value}
    </span>
  </div>
);

export default IndicacaoTeste;
