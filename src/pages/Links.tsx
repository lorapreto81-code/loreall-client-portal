import { MessageCircle, Headphones, Gift, Megaphone, LogIn, Youtube, Tv, Popcorn } from "lucide-react";
import LaunchesBanner from "@/components/LaunchesBanner";

const logo = "/logo.png";

const SUPPORT_PHONE = "5583985591952";
const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VaduriNK0IBn0u0JUK1o";
const SUPPORT_WA = `https://wa.me/${SUPPORT_PHONE}?text=Olá!%20Vim%20do%20YouTube%20e%20preciso%20de%20suporte%2Finstalação.`;
const TRIAL_WA = `https://wa.me/${SUPPORT_PHONE}?text=Olá!%20Vim%20do%20YouTube%20e%20quero%20fazer%20o%20TESTE%20GRÁTIS%20da%20Loreall%20Play%20TV.`;

type LinkItem = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  highlight?: boolean;
  external?: boolean;
};

const items: LinkItem[] = [
  {
    href: TRIAL_WA,
    icon: Gift,
    title: "Teste Grátis",
    subtitle: "Solicite seu acesso de teste agora",
    highlight: true,
    external: true,
  },
  {
    href: SUPPORT_WA,
    icon: Headphones,
    title: "Suporte e Instalação",
    subtitle: "Fale com nosso atendimento no WhatsApp",
    external: true,
  },
  {
    href: WHATSAPP_CHANNEL,
    icon: Megaphone,
    title: "Canal no WhatsApp",
    subtitle: "Atualizações de jogos, filmes e séries",
    external: true,
  },
  {
    href: "/login",
    icon: LogIn,
    title: "Minha Conta",
    subtitle: "Acessar / renovar seu plano",
  },
];

const Links = () => {
  return (
    <div className="min-h-screen bg-background px-4 py-10 flex flex-col items-center">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <img src={logo} alt="Loreall Play TV" style={{ width: 96, height: "auto" }} className="mb-4" />
          <h1 className="text-xl font-bold text-foreground">Loreall Play TV</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Filmes, séries, esportes e canais ao vivo em alta qualidade.
          </p>
          <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Youtube className="h-3.5 w-3.5" /> YouTube
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Tv className="h-3.5 w-3.5" /> Streaming
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {items.map(({ href, icon: Icon, title, subtitle, highlight, external }) => {
            const baseClasses =
              "w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-[0.99]";
            const styleClasses = highlight
              ? "btn-primary-gradient text-white shadow-md"
              : "card-elevated hover:border-ring";
            const subColor = highlight ? "text-white/85" : "text-muted-foreground";
            const iconWrap = highlight
              ? "bg-white/15 text-white"
              : "bg-accent/10 text-accent";

            const content = (
              <>
                <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${iconWrap}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold leading-tight">{title}</div>
                  <div className={`text-[11px] mt-0.5 ${subColor}`}>{subtitle}</div>
                </div>
                <MessageCircle className={`h-4 w-4 ${highlight ? "text-white/70" : "text-muted-foreground"}`} />
              </>
            );

            return external ? (
              <a
                key={title}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${baseClasses} ${styleClasses}`}
              >
                {content}
              </a>
            ) : (
              <a key={title} href={href} className={`${baseClasses} ${styleClasses}`}>
                {content}
              </a>
            );
          })}
        </div>


        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Popcorn className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Atualizações de Filmes e Séries</h2>
          </div>
          <LaunchesBanner />
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            Novidades atualizadas diariamente
          </p>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-8">
          © {new Date().getFullYear()} Loreall Play TV
        </p>
      </div>
    </div>
  );
};

export default Links;
