import { useLoginFlow } from "@/features/auth/hooks/useLoginFlow";
import { AccountSelection } from "@/features/auth/components/AccountSelection";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { logo } from "@/utils/constants";
import indiqueBanner from "@/assets/indique-ganhe-banner.jpg.asset.json";

const Login = () => {
  const {
    phone,
    setPhone,
    code,
    setCode,
    step,
    setStep,
    resendIn,
    loading,
    refCode,
    matches,
    setMatches,
    targetHint,
    customerName,
    pickAccount,
    sendCode,
    handleSubmit
  } = useLoginFlow();

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
            <h1 className="text-xl font-black text-foreground leading-tight tracking-tight uppercase">
              Acesse Seu <span className="text-primary premium-text-glow">Mundo VIP</span>
            </h1>
            <p className="text-[10px] font-bold text-primary/80 uppercase tracking-[0.3em] mt-0.5">
              Experiência Ultra Premium
            </p>
          </div>
        </div>

        <div className="rounded-2xl p-5 border border-white/5 bg-card/60 backdrop-blur-2xl premium-shadow">
          {matches.length > 1 ? (
            <AccountSelection 
              matches={matches} 
              onPick={pickAccount} 
              onBack={() => setMatches([])} 
            />
          ) : (
            <LoginForm 
              step={step}
              phone={phone}
              code={code}
              loading={loading}
              resendIn={resendIn}
              refCode={refCode}
              targetHint={targetHint}
              customerName={customerName}
              onPhoneChange={setPhone}
              onCodeChange={setCode}
              onSendCode={sendCode}
              onBackToPhone={() => { setStep("phone"); setCode(""); }}
              onSubmit={handleSubmit}
            />
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