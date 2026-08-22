import { MessageCircle, Lock, Loader2, User, ArrowLeft, Gift } from "lucide-react";
import { onlyDigits } from "@/utils/formatters";
import { useEffect, useState } from "react";
import { COUNTRIES, formatNational, splitPhone, toE164Digits } from "@/utils/countries";

interface LoginFormProps {
  step: "phone" | "code";
  phone: string;
  code: string;
  loading: boolean;
  resendIn: number;
  refCode: string | null;
  targetHint: string | null;
  customerName: string | null;
  onPhoneChange: (val: string) => void;
  onCodeChange: (val: string) => void;
  onSendCode: () => void;
  onBackToPhone: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const LoginForm = ({
  step,
  phone,
  code,
  loading,
  resendIn,
  refCode,
  targetHint,
  customerName,
  onPhoneChange,
  onCodeChange,
  onSendCode,
  onBackToPhone,
  onSubmit
}: LoginFormProps) => {
  const [dial, setDial] = useState(() => splitPhone(phone).dial);
  // Raw text exactly as typed by the user (keeps "24max..." intact while it is still ambiguous)
  const [raw, setRaw] = useState(() => (phone ? splitPhone(phone).national : ""));

  useEffect(() => {
    if (phone === "") setRaw("");
  }, [phone]);

  const isTextMode = /[a-zA-Z@]/.test(raw);
  const digits = onlyDigits(raw);
  // Country selector only appears once we are sure it is a phone number
  const showCountry = !isTextMode && digits.length >= 4;

  return (
    <>
      <div className="mb-5">
        {step === "phone" ? (
          <>
            <p className="text-sm font-medium text-foreground mb-1">Identifique-se para continuar</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Informe seu <span className="text-foreground font-semibold">WhatsApp</span>, <span className="text-foreground font-semibold">E-mail</span> ou <span className="text-foreground font-semibold">Usuário</span>. 
              Você receberá um <span className="text-primary font-bold">Código de Acesso Seguro</span> instantaneamente.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground mb-1">
              Verificação de Segurança {customerName ? `• ${customerName}` : ""}
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              O seu código exclusivo de 6 dígitos foi enviado para o WhatsApp de final <span className="text-primary font-bold">{targetHint || "..."}</span> vinculado ao seu acesso.
            </p>
          </>
        )}
      </div>

      {refCode && (
        <div className="mb-5 p-3.5 rounded-xl flex items-start gap-3 border border-primary/20 bg-primary/5 animate-pulse-subtle">
          <Gift className="h-5 w-5 text-primary shrink-0" />
          <div className="text-[11px] text-foreground leading-snug">
            <span className="font-bold text-primary">BÔNUS ATIVO:</span> Você foi convidado! 
            Ao garantir seu plano, você e seu amigo desbloqueiam <span className="font-bold underline">+30 dias de presente</span>.
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        {step === "phone" ? (
          <div>
            <div className="flex items-stretch gap-2">
              {showCountry && (
                <select
                  aria-label="País"
                  value={dial}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDial(next);
                    onPhoneChange(toE164Digits(next, digits));
                  }}
                  className="shrink-0 w-[88px] px-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.dial}>
                      {c.code} +{c.dial}
                    </option>
                  ))}
                </select>
              )}
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  value={showCountry ? formatNational(dial, digits) : raw}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 100);
                    const isText = /[a-zA-Z@]/.test(val);
                    if (isText) {
                      setRaw(val);
                      onPhoneChange(val.toLowerCase().trim());
                      return;
                    }
                    const nat = onlyDigits(val).slice(0, 15);
                    setRaw(nat);
                    if (nat === "") {
                      onPhoneChange("");
                    } else if (nat.length >= 4) {
                      onPhoneChange(toE164Digits(dial, nat));
                    } else {
                      onPhoneChange(nat);
                    }
                  }}
                  className="w-full h-12 pl-10 pr-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow text-sm"
                  placeholder="WhatsApp, e-mail ou usuário"
                  autoComplete="username"
                />
                <User className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            {isTextMode && (
              <p className="mt-1.5 text-[10px] text-muted-foreground leading-snug">
                E-mail ou usuário detectado — seletor de país não é necessário.
              </p>
            )}
          </div>

        ) : (
          <>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => onCodeChange(onlyDigits(e.target.value).slice(0, 6))}
                className="w-full pl-10 pr-3 py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow text-center text-lg font-bold tracking-[0.5em]"
                placeholder="000000"
                autoComplete="one-time-code"
                autoFocus
              />
              <Lock className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={onBackToPhone}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" /> Trocar número
              </button>
              <button
                type="button"
                disabled={resendIn > 0 || loading}
                onClick={onSendCode}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {resendIn > 0 ? `Reenviar em ${resendIn}s` : "Reenviar código"}
              </button>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 btn-primary-gradient font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-60 uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : step === "phone" ? (
            <>
              <MessageCircle className="h-5 w-5" />
              Obter Acesso Imediato
            </>
          ) : (
            <>
              <Lock className="h-5 w-5" />
              Desbloquear Agora
            </>
          )}
        </button>

        {step === "code" && (
          <p className="text-[10px] text-muted-foreground text-center pt-2 font-medium">
            Ainda não recebeu? Verifique seu WhatsApp.
          </p>
        )}
      </form>

      <div className="mt-3 pt-3 border-t border-border/20">
        <a
          href="https://wa.me/5583985591952?text=Olá!%20Não%20tenho%20acesso%20e%20gostaria%20de%20criar%20minha%20conta%20na%20Loreall%20Play%20TV."
          target="_blank"
          rel="noopener noreferrer"
          className="w-full text-[11px] font-medium text-muted-foreground transition-colors flex items-center justify-center gap-1 group"
        >
          <span>Novo por aqui?</span>
          <span className="text-primary font-bold hover:underline decoration-2 underline-offset-2">Experimentar Grátis 📺</span>
        </a>
      </div>
    </>
  );
};