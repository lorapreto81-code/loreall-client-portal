import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Lock, Mail, MessageCircle, Loader2 } from "lucide-react";
import { useLoginFlow } from "@/features/auth/hooks/useLoginFlow";
import { AccountSelection } from "@/features/auth/components/AccountSelection";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { logo } from "@/utils/constants";
import indiqueBanner from "@/assets/indique-ganhe-banner.webp.asset.json";
import renoveBanner from "@/assets/renove-assinatura-banner.webp.asset.json";

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
    channel,
    channelOptions,
    setChannelOptions,
    pickAccount,
    sendCode,
    handleSubmit
  } = useLoginFlow();

  return (
    <div className="min-h-screen flex items-start justify-center bg-background px-4 py-6 sm:pt-14 sm:pb-8 relative overflow-hidden">
      {/* Ambient gradient glow */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[min(560px,140vw)] h-[420px] rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.22),hsl(var(--accent)/0.08)_60%,transparent)] pointer-events-none" />
      <div className="absolute -bottom-32 -right-24 w-[420px] h-[420px] rounded-full bg-[radial-gradient(closest-side,hsl(var(--secondary)/0.12),transparent)] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 flex flex-col gap-5">
        {/* Logo compacta + Headline Persuasiva */}
        <div className="flex flex-col items-center gap-3 pt-1 text-center">
          <div className="relative">
            <div className="absolute inset-0 -m-4 rounded-full bg-[radial-gradient(closest-side,hsl(var(--accent)/0.25),hsl(var(--secondary)/0.12)_60%,transparent)] pointer-events-none" />
            <img src={logo} alt="Loreall Play TV" className="relative" style={{ width: 84, height: "auto" }} />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground leading-tight tracking-tight">
              Acesse sua conta
            </h1>
            <p className="text-xs font-medium text-muted-foreground">
              Loreall Play
            </p>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-card/70 backdrop-blur-xl shadow-[0_20px_40px_-24px_hsl(var(--primary)/0.35)]">
          <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-secondary" />
          <div className="p-5 sm:p-6">
          {matches.length > 1 ? (
            <AccountSelection 
              matches={matches} 
              onPick={pickAccount} 
              onBack={() => setMatches([])} 
            />
          ) : channelOptions ? (
            <ChannelChoice
              name={customerName}
              options={channelOptions}
              loading={loading}
              onPick={(c) => sendCode(c)}
              onBack={() => setChannelOptions(null)}
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
              channel={channel}
              onPhoneChange={setPhone}
              onCodeChange={setCode}
              onSendCode={() => sendCode()}
              onBackToPhone={() => { setStep("phone"); setCode(""); }}
              onSubmit={handleSubmit}
            />
          )}
          </div>
        </div>

        {/* Banner rotativo: Renove → Indique e Ganhe */}
        <div className="relative h-auto w-[92%] mx-auto mt-2">
          <BannerRotativo />
        </div>

        <p className="text-[10px] text-muted-foreground/50 text-center flex flex-col items-center gap-1 pb-2">
          <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Acesso 100% seguro e protegido</span>
          <span>© Loreall Play TV — Entretenimento Premium Sem Limites.</span>
        </p>
      </div>
    </div>
  );
};

const ChannelChoice = ({ name, options, loading, onPick, onBack }: {
  name: string | null;
  options: { whatsapp: string; email: string; preferred: "whatsapp" | "email" };
  loading: boolean;
  onPick: (c: "whatsapp" | "email") => void;
  onBack: () => void;
}) => {
  const items = [
    { id: "whatsapp" as const, icon: MessageCircle, title: "WhatsApp", hint: `Final ${options.whatsapp.replace(/\D/g, "")}`, color: "text-emerald-500 bg-emerald-500/10" },
    { id: "email" as const, icon: Mail, title: "E-mail", hint: options.email, color: "text-accent bg-accent/10" },
  ].sort((a) => (a.id === options.preferred ? -1 : 1));
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground mb-1">{name ? `Olá, ${name}!` : "Quase lá!"}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">Onde você quer receber seu código de acesso?</p>
      </div>
      <div className="space-y-2">
        {items.map(({ id, icon: Icon, title, hint, color }) => (
          <button key={id} type="button" disabled={loading} onClick={() => onPick(id)}
            className="w-full flex items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3.5 text-left transition-all duration-200 hover:border-accent hover:ring-4 hover:ring-accent/10 disabled:opacity-60">
            <span className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${color}`}><Icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-foreground">{title}</span>
              <span className="block text-[11px] text-muted-foreground truncate">{hint}</span>
            </span>
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>
        ))}
      </div>
      <button type="button" onClick={onBack} className="text-[11px] text-muted-foreground hover:text-foreground">← Voltar</button>
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
      <div className="relative w-full aspect-[1200/680] rounded-2xl overflow-hidden border border-border/50 shadow-[0_12px_28px_-18px_hsl(var(--background))] bg-transparent p-0">
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
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === active ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
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