import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
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
    `📅 *Teste:* 4 horas\n` +
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

  // Se não temos código válido → tela de entrada de código
  if (needsCode && !result) {
    return (
      <div className="min-h-screen flex items-start justify-center px-4 py-10" style={pageStyle}>
        <div className="w-full max-w-[420px] flex flex-col gap-6">
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
                Tem um código de indicação?
              </h1>
              <p className="text-sm" style={{ color: MUTED }}>
                Digite abaixo o código que você recebeu de outro cliente para liberar o seu teste grátis com bônus.
              </p>
            </div>
          </header>

          {invalid && (
            <div
              className="rounded-2xl p-3.5 flex items-start gap-2.5"
              style={{
                backgroundColor: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.20)",
              }}
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#ef4444" }} />
              <p className="text-xs" style={{ color: "#b91c1c" }}>
                O link usado não é válido. Você pode digitar o código manualmente abaixo.
              </p>
            </div>
          )}

          <SoftCard className="p-6 space-y-5">
            <div
              className="flex items-center gap-3 rounded-2xl p-3.5"
              style={{
                background: "linear-gradient(135deg, #FFF7E0, #FDE7B5)",
                border: "1px solid #E0A93A",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#E0A93A" }}
              >
                <Sparkles className="h-5 w-5" style={{ color: "#4A2B00" }} />
              </div>
              <div className="text-sm leading-tight">
                <p className="font-bold" style={{ color: "#4A2B00" }}>
                  Bônus de +5% no teste grátis
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#6B3F00" }}>
                  Cadastrando com código de indicação você ganha um bônus extra na ativação.
                </p>
              </div>
            </div>

            <Field
              label="Código de indicação"
              icon={<KeyRound className="h-4 w-4" style={{ color: MUTED }} />}
            >
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                maxLength={20}
                className="w-full bg-transparent outline-none text-sm font-semibold tracking-widest uppercase"
                style={{ color: TEXT }}
                placeholder="EX: JOAO123"
                onKeyDown={(e) => e.key === "Enter" && handleValidateManual()}
              />
            </Field>

            <button
              type="button"
              onClick={handleValidateManual}
              disabled={validating || manualCode.trim().length < 3}
              className="w-full h-12 rounded-2xl font-bold text-sm inline-flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: ACCENT, color: "#fff" }}
            >
              {validating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {validating ? "Validando..." : "Validar código"}
            </button>
          </SoftCard>

          <p className="text-xs text-center" style={{ color: MUTED }}>
            Não tem código?{" "}
            <Link to="/login" className="font-semibold" style={{ color: ACCENT }}>
              Fazer login
            </Link>
          </p>
        </div>
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
              <Row label="Teste liberado" value="4 horas" />
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
                Ganhe 4 horas de teste com {config?.telas || 1} tela.
              </p>
            </div>
          </div>

          {/* Código de indicação visível + copiar */}
          <div
            className="flex items-center justify-between gap-3 rounded-2xl p-3"
            style={{ backgroundColor: "#f7f9fc", border: `1px dashed ${BORDER}` }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <KeyRound className="h-4 w-4 shrink-0" style={{ color: MUTED }} />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: MUTED }}>
                  Código de indicação
                </p>
                <p className="text-sm font-bold tracking-widest truncate" style={{ color: TEXT }}>
                  {code}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="shrink-0 h-9 px-3 rounded-xl inline-flex items-center gap-1.5 text-xs font-semibold transition-transform active:scale-95"
              style={{ backgroundColor: ACCENT, color: "#fff" }}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>

          {/* Bônus +5% */}
          <div
            className="flex items-center gap-3 rounded-2xl p-3.5"
            style={{
              background: "linear-gradient(135deg, #FFF7E0, #FDE7B5)",
              border: "1px solid #E0A93A",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#E0A93A" }}
            >
              <Sparkles className="h-5 w-5" style={{ color: "#4A2B00" }} />
            </div>
            <div className="text-sm leading-tight">
              <p className="font-bold" style={{ color: "#4A2B00" }}>
                Bônus de +5% ativado
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#6B3F00" }}>
                Você entrou por indicação — bônus extra aplicado na sua ativação.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <BenefitRow icon={<Sparkles className="h-4 w-4" />} text="Acesso imediato ao catálogo completo" />
            <BenefitRow icon={<ShieldCheck className="h-4 w-4" />} text="Sem cartão de crédito, sem compromisso" />
            <BenefitRow icon={<MessageCircle className="h-4 w-4" />} text="Suporte humano no WhatsApp" />
          </div>
        </SoftCard>
        )}

        {choice === "payment" && (
          <SoftCard className="p-6 space-y-4 text-center">
            <p className="text-sm font-semibold" style={{ color: TEXT }}>
              Perfeito! Fala com a gente agora pra ativar seu acesso.
            </p>
            <a
              href={`https://wa.me/55${onlyDigits(config?.support_whatsapp || "").replace(/^55/, "")}?text=${encodeURIComponent(
                `Olá! Fui indicado por ${referrerName} e quero assinar direto.`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-semibold text-sm"
              style={{ backgroundColor: ACCENT, color: "#fff" }}
            >
              <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
            </a>
            <button
              type="button"
              onClick={() => setChoice(null)}
              className="block mx-auto text-xs font-semibold"
              style={{ color: MUTED }}
            >
              Voltar
            </button>
          </SoftCard>
        )}

        {/* Formulário */}
        {choice === "trial" && (
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
        )}

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
