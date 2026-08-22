import { MessageCircle, Lock, Loader2, User, ArrowLeft, Gift } from "lucide-react";
import { EMAIL_RE } from "@/utils/constants";
import { formatPhone, onlyDigits } from "@/utils/formatters";

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
          <div className="relative">
            <input
              type="text"
              value={EMAIL_RE.test(phone) || /[a-zA-Z]/.test(phone) ? phone : formatPhone(phone)}
              onChange={(e) => {
                const raw = e.target.value;
                const val = raw.slice(0, 100);
                
                // If it contains letters or @, treat as email/text
                if (/[a-zA-Z]/.test(val) || val.includes("@")) {
                  onPhoneChange(val.toLowerCase());
                } else if (val === "") {
                  onPhoneChange("");
                } else {
                  // If it's just numbers and phone formatting chars, keep it as digits
                  // but ONLY if there are no letters.
                  onPhoneChange(onlyDigits(val).slice(0, 15));
                }
              }}
              className="w-full pl-10 pr-3 py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow text-sm"
              placeholder="WhatsApp, e-mail ou usuário"
              autoComplete="username"
            />
            <User className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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