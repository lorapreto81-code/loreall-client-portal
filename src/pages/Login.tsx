import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Gift, MessageCircle, Lock, ArrowLeft, User } from "lucide-react";
import { requestOtp, verifyOtp, LoginAccount } from "@/lib/api";
import { useAuthStore, Customer } from "@/store/authStore";
import indiqueBanner from "@/assets/indique-ganhe-banner.jpg.asset.json";
import { onlyDigits, formatPhone } from "@/utils/formatters";
import { AccountSelection } from "@/features/auth/components/AccountSelection";
import { logo, REF_KEY, EMAIL_RE } from "@/utils/constants";


const Login = () => {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [resendIn, setResendIn] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [matches, setMatches] = useState<LoginAccount[]>([]);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      const c = ref.trim().toUpperCase();
      localStorage.setItem(REF_KEY, c);
      navigate(`/indicacao/${c}`, { replace: true });
      return;
    }
    const stored = localStorage.getItem(REF_KEY);
    if (stored) setRefCode(stored);
  }, [navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const pickAccount = (account: LoginAccount) => {
    const c = account.customer as unknown as Customer;
    login(c, account.token);
    toast.success("Bem-vindo, " + c.name + "!");
    navigate("/welcome");
  };

  const sendCode = async () => {
    const isEmail = EMAIL_RE.test(phone);
    const digits = onlyDigits(phone);
    
    if (!isEmail && digits.length < 10) {
      toast.error("Informe seu WhatsApp com DDD ou um E-mail válido.");
      return;
    }
    
    const identifier = isEmail ? phone : digits;
    setLoading(true);
    try {
      const res = await requestOtp(identifier);
      toast.success(res.message || "Código enviado no seu WhatsApp.");
      setStep("code");
      setResendIn(60);
    } catch (err: any) {
      toast.error(err.message || "Não foi possível enviar o código.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === "phone") {
      await sendCode();
      return;
    }
    const c = onlyDigits(code);
    if (c.length !== 6) {
      toast.error("Digite o código de 6 dígitos.");
      return;
    }
    setLoading(true);
    try {
      const identifier = EMAIL_RE.test(phone) ? phone : onlyDigits(phone);
      const { accounts } = await verifyOtp(identifier, c);
      if (!accounts || accounts.length === 0) {
        toast.error("Conta não encontrada.");
        return;
      }
      if (accounts.length === 1) {
        pickAccount(accounts[0]);
        return;
      }
      setMatches(accounts);
    } catch (err: any) {
      toast.error(err.message || "Código inválido.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 relative overflow-hidden">
      {/* Ambient gradient glow */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-primary/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[380px] h-[380px] rounded-full bg-secondary/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 flex flex-col gap-4">
        {/* Logo compacta + Headline Persuasiva */}
        <div className="flex flex-col items-center gap-2 pt-1 text-center">
          <img src={logo} alt="Loreall Play TV" style={{ width: 70, height: "auto" }} />
          <div className="space-y-0.5">
            <h1 className="text-lg font-bold text-foreground leading-tight tracking-tight">
              Acesse Seu <span className="text-primary">Mundo VIP</span>
            </h1>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.2em]">
              Sua Experiência Premium
            </p>
          </div>
        </div>


        <div
          className="rounded-2xl p-5 border border-white/5 bg-card/60 backdrop-blur-2xl premium-shadow"
        >
          {matches.length > 1 ? (
            <AccountSelection 
              matches={matches} 
              onPick={pickAccount} 
              onBack={() => setMatches([])} 
            />
          ) : (
            <>
              <div className="mb-5">
                {step === "phone" ? (
                  <>
                    <p className="text-sm font-medium text-foreground mb-1">Identifique-se para continuar</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Informe seu <span className="text-foreground font-semibold">WhatsApp</span> ou <span className="text-foreground font-semibold">E-mail</span>. 
                      Você receberá um <span className="text-primary font-bold">Código de Acesso Seguro</span> instantaneamente.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground mb-1">Verificação de Segurança</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      O seu código exclusivo de 6 dígitos foi enviado para{" "}
                      <span className="font-bold text-foreground">
                        {EMAIL_RE.test(phone) ? phone : formatPhone(phone)}
                      </span>.
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


              <form onSubmit={handleSubmit} className="space-y-3">
                {step === "phone" ? (
                  <div className="relative">
                    <input
                      type="text"
                      value={EMAIL_RE.test(phone) ? phone : formatPhone(phone)}
                      onChange={(e) => {
                        const val = e.target.value.trim().slice(0, 100); // Sanitize and limit
                        if (EMAIL_RE.test(val) || (val.includes("@") && !onlyDigits(val))) {
                          setPhone(val.toLowerCase());
                        } else {
                          setPhone(onlyDigits(val).slice(0, 11));
                        }
                      }}
                      className="w-full pl-10 pr-3 py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow text-sm"
                      placeholder="WhatsApp ou E-mail"
                      autoComplete="username"
                    />
                    <User className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={code}
                        onChange={(e) => setCode(onlyDigits(e.target.value).slice(0, 6))}
                        className="w-full pl-10 pr-3 py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow text-center text-lg font-bold tracking-[0.5em]"
                        placeholder="000000"
                        autoComplete="one-time-code"
                        autoFocus
                      />
                      <Lock className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <button
                        type="button"
                        onClick={() => { setStep("phone"); setCode(""); }}
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <ArrowLeft className="h-3 w-3" /> Trocar número
                      </button>
                      <button
                        type="button"
                        disabled={resendIn > 0 || loading}
                        onClick={sendCode}
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
          )}
        </div>

        {/* Banner Indique e Ganhe */}
        <a
          href="https://wa.me/5583985591952?text=Olá!%20Quero%20saber%20mais%20sobre%20a%20promoção%20Indique%20e%20Ganhe."
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-2xl overflow-hidden border border-border/60 transition-transform hover:scale-[1.01] active:scale-[0.99] bg-card/40"
          style={{ boxShadow: "0 20px 50px -20px rgba(0,0,0,0.6)" }}
          aria-label="Indique e ganhe 1 mês grátis"
        >
          <img
            src={indiqueBanner.url}
            alt="Indique e ganhe +1 mês grátis para cada amigo que assinar"
            className="w-full h-auto block"
            loading="lazy"
          />
        </a>

        <p className="text-[10px] text-muted-foreground/60 text-center font-medium flex flex-col gap-1">
          <span>🔒 Acesso 100% seguro e protegido</span>
          <span>© Loreall Play TV — Entretenimento Premium Sem Limites.</span>
        </p>
      </div>
    </div>
  );
};

export default Login;
