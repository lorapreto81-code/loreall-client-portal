import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLoginFlow } from "@/features/auth/hooks/useLoginFlow";
import { AccountSelection } from "@/features/auth/components/AccountSelection";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { logo } from "@/utils/constants";
import indiqueBanner from "@/assets/indique-ganhe-banner-v2.png.asset.json";
import renoveBanner from "@/assets/renove-assinatura-banner.png.asset.json";

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
    <div className="min-h-screen flex items-start justify-center bg-background px-4 pt-16 pb-8 relative overflow-hidden">
      {/* Ambient gradient glow */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-primary/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[380px] h-[380px] rounded-full bg-secondary/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 flex flex-col gap-4">
        {/* Logo compacta + Headline Persuasiva */}
        <div className="flex flex-col items-center gap-2 pt-1 text-center">
          <img src={logo} alt="Loreall Play TV" style={{ width: 70, height: "auto" }} />
          <div className="space-y-0.5">
            <h1 className="text-xl font-semibold text-foreground leading-tight">
              Acesse sua conta
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Loreall Play
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

        {/* Banner rotativo: Renove → Indique e Ganhe */}
        <div className="relative h-auto">
          <BannerRotativo />
        </div>

        <p className="text-[10px] text-muted-foreground/60 text-center font-medium flex flex-col gap-1">
          <span>🔒 Acesso 100% seguro e protegido</span>
          <span>© Loreall Play TV — Entretenimento Premium Sem Limites.</span>
        </p>
      </div>
    </div>
  );
};

const banners = [
  {
    id: "renove",
    asset: renoveBanner,
    alt: "Renove sua assinatura ou atualize seu acesso agora",
    href: "https://wa.me/5583985591952?text=Olá!%20Quero%20renovar%20minha%20assinatura.",
    label: "Renove sua assinatura"
  },
  {
    id: "indique",
    asset: indiqueBanner,
    alt: "Indique e ganhe +1 mês grátis para cada amigo que assinar",
    href: "https://wa.me/5583985591952?text=Olá!%20Quero%20saber%20mais%20sobre%20a%20promoção%20Indique%20e%20Ganhe.",
    label: "Indique e ganhe 1 mês grátis"
  }
];

const BannerRotativo = () => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const next = () => setActive((prev) => (prev + 1) % banners.length);
  const prev = () => setActive((prev) => (prev - 1 + banners.length) % banners.length);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full aspect-[1200/650] rounded-2xl overflow-hidden border border-white/5 bg-transparent p-0">
        <div className="w-full h-full relative">
          {banners.map((banner, index) => (
            <a
              key={banner.id}
              href={banner.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`absolute inset-0 transition-opacity duration-700 ${
                index === active ? "opacity-100 z-10" : "opacity-0 z-0"
              }`}
              aria-label={banner.label}
              aria-hidden={index !== active}
            >
              <img
                src={banner.asset.url}
                alt={banner.alt}
                className="w-full h-full object-cover block"
                loading={index === 0 ? "eager" : "lazy"}
              />
            </a>
          ))}
        </div>
      </div>

      {/* Indicadores que funcionam como seletores */}
      <div className="flex items-center justify-center gap-2 mt-1" role="group" aria-label="Selecionar banner">
        {banners.map((banner, index) => (
          <button
            key={banner.id}
            type="button"
            onClick={() => setActive(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === active ? "w-8 bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
            aria-label={`Ver ${banner.label}`}
            aria-pressed={index === active}
          />
        ))}
      </div>
    </div>
  );
};

export default Login;