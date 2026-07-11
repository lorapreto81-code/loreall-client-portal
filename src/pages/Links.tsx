import { Gift, Headphones, Megaphone, User, ChevronRight, MessageCircle, Popcorn } from "lucide-react";
import LaunchesBanner from "@/components/LaunchesBanner";

const logo = "/logo.png";

const SUPPORT_PHONE = "5583985591952";
const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VaduriNK0IBn0u0JUK1o";
const SUPPORT_WA = `https://wa.me/${SUPPORT_PHONE}?text=Olá!%20Vim%20do%20YouTube%20e%20preciso%20de%20suporte%2Finstalação.`;
const TRIAL_WA = `https://wa.me/${SUPPORT_PHONE}?text=Olá!%20Vim%20do%20YouTube%20e%20quero%20fazer%20o%20TESTE%20GRÁTIS%20da%20Loreall%20Play%20TV.`;

const Links = () => {
  return (
    <div className="min-h-screen bg-background px-6 py-8 flex items-start justify-center">
      <div className="w-full max-w-[420px] flex flex-col gap-7">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-4">
          <img src={logo} alt="Loreall Play TV" style={{ width: 88, height: "auto" }} />
          <div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              Loreall Play TV
            </h1>
            <div className="flex flex-wrap justify-center gap-x-2 mt-2 text-[11px] text-muted-foreground font-medium">
              <span>CANAIS</span>
              <span className="opacity-30">•</span>
              <span>FILMES</span>
              <span className="opacity-30">•</span>
              <span>SÉRIES</span>
              <span className="opacity-30">•</span>
              <span>ESPORTES</span>
            </div>
          </div>
          <div className="bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-full">
            <span className="text-[10px] font-bold text-primary tracking-wider uppercase">
              +200 mil conteúdos disponíveis 24h
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          {/* Primary CTA — Minha Conta */}
          <a
            href="/login"
            className="group relative block w-full p-px rounded-2xl overflow-hidden shadow-xl active:scale-[0.98] transition-transform"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary to-secondary" />
            <div className="relative bg-card rounded-[15px] p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-foreground">
                  <User className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-bold text-lg">Minha Conta</span>
                    <span className="bg-primary text-[9px] font-black px-1.5 py-0.5 rounded text-primary-foreground tracking-tight">
                      PRO
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">Acessar ou renovar plano</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
            </div>
          </a>

          {/* Divider */}
          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-border" />
            <span className="flex-shrink mx-4 text-[10px] font-bold text-muted-foreground tracking-[0.2em] uppercase">
              Central de Acesso
            </span>
            <div className="flex-grow border-t border-border" />
          </div>

          {/* Teste Grátis */}
          <a
            href={TRIAL_WA}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center p-4 bg-card border border-border rounded-2xl group hover:border-accent/60 transition-all active:scale-[0.99]"
          >
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent mr-4">
              <Gift className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-foreground font-semibold">Teste Grátis</h3>
              <p className="text-[13px] text-muted-foreground">Solicite seu acesso agora</p>
            </div>
            <MessageCircle className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
          </a>

          {/* Suporte + Canal */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={SUPPORT_WA}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-card border border-border rounded-2xl flex flex-col gap-3 hover:border-primary/50 transition-all"
            >
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-bold text-foreground block">Suporte</span>
                <span className="text-[10px] text-muted-foreground">Ajuda e instalação</span>
              </div>
            </a>
            <a
              href={WHATSAPP_CHANNEL}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-card border border-border rounded-2xl flex flex-col gap-3 hover:border-secondary/50 transition-all"
            >
              <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center text-secondary">
                <Megaphone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-bold text-foreground block">Canal VIP</span>
                <span className="text-[10px] text-muted-foreground">Novidades diárias</span>
              </div>
            </a>
          </div>
        </div>

        {/* Lançamentos */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Popcorn className="w-3.5 h-3.5 text-accent" />
              Novos Lançamentos
            </h2>
          </div>
          <LaunchesBanner />
        </div>

        <p className="text-center text-[10px] text-muted-foreground/70 font-semibold tracking-widest uppercase pt-2">
          © {new Date().getFullYear()} Loreall Play TV
        </p>
      </div>
    </div>
  );
};

export default Links;
