import { User, Gift, Headphones, Megaphone, ChevronRight, Popcorn } from "lucide-react";
import LaunchesBanner from "@/components/LaunchesBanner";

const logo = "/logo.png";

const SUPPORT_PHONE = "5583985591952";
const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VaduriNK0IBn0u0JUK1o";
const SUPPORT_WA = `https://wa.me/${SUPPORT_PHONE}?text=Olá!%20Vim%20do%20YouTube%20e%20preciso%20de%20suporte%2Finstalação.`;
const TRIAL_WA = `https://wa.me/${SUPPORT_PHONE}?text=Olá!%20Vim%20do%20YouTube%20e%20quero%20fazer%20o%20TESTE%20GRÁTIS%20da%20Loreall%20Play%20TV.`;

/**
 * Public link-in-bio page — LIGHT theme (independent from the app's dark theme).
 * Design tokens locked from the "Cards macios" direction:
 *   bg #fafbfc / surfaces #ffffff / borders #e8ecf1 / text #0f172a / muted #94a3b8 / accent #3b82f6
 *   Fonts: Outfit (headings) + Figtree (body) — loaded via index.html.
 */
const Links = () => {
  return (
    <div
      className="min-h-screen w-full flex items-start justify-center py-10 px-4 antialiased"
      style={{
        backgroundColor: "#fafbfc",
        color: "#0f172a",
        fontFamily: "'Figtree', system-ui, sans-serif",
      }}
    >
      <div className="w-full max-w-[420px] flex flex-col gap-8">
        {/* Header */}
        <header className="flex flex-col items-center text-center gap-4">
          <div
            className="w-24 h-24 rounded-[2rem] flex items-center justify-center overflow-hidden"
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e8ecf1",
              boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
            }}
          >
            <img src={logo} alt="Loreall Play TV" className="w-16 h-auto" />
          </div>
          <div className="space-y-1">
            <h1
              className="text-2xl font-extrabold tracking-tight"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Loreall Play TV
            </h1>
            <p
              className="text-[10px] font-medium tracking-[0.2em] uppercase"
              style={{ color: "#94a3b8" }}
            >
              CANAIS • FILMES • SÉRIES • ESPORTES
            </p>
          </div>
          <div
            className="inline-flex items-center px-3.5 py-1.5 rounded-full"
            style={{ backgroundColor: "rgba(59,130,246,0.1)" }}
          >
            <span className="text-[11px] font-bold" style={{ color: "#3b82f6" }}>
              +200 mil conteúdos disponíveis 24h
            </span>
          </div>
        </header>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {/* Primary — Minha Conta */}
          <a
            href="/login"
            className="group relative w-full p-5 rounded-[2rem] flex items-center gap-4 transition-all text-left"
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e8ecf1",
              boxShadow: "0 8px 20px -4px rgba(0,0,0,0.04)",
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: "#3b82f6",
                color: "#ffffff",
                boxShadow: "0 8px 16px -4px rgba(59,130,246,0.35)",
              }}
            >
              <User className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="font-bold text-lg"
                  style={{ fontFamily: "'Outfit', sans-serif", color: "#0f172a" }}
                >
                  Minha Conta
                </span>
                <span
                  className="text-[9px] font-black px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: "#0f172a", color: "#ffffff" }}
                >
                  PRO
                </span>
              </div>
              <p className="text-sm" style={{ color: "#94a3b8" }}>
                Acessar ou renovar plano
              </p>
            </div>
            <ChevronRight
              className="w-5 h-5 group-hover:translate-x-1 transition-transform"
              style={{ color: "#94a3b8" }}
              strokeWidth={2.5}
            />
          </a>

          {/* Secondary — Teste Grátis */}
          <a
            href={TRIAL_WA}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full p-5 rounded-[2rem] flex items-center gap-4 transition-all text-left hover:bg-[#f8fafc]"
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e8ecf1",
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e8ecf1",
                color: "#3b82f6",
              }}
            >
              <Gift className="w-[22px] h-[22px]" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <span
                className="font-bold"
                style={{ fontFamily: "'Outfit', sans-serif", color: "#0f172a" }}
              >
                Teste Grátis
              </span>
              <p className="text-sm" style={{ color: "#94a3b8" }}>
                Solicite seu acesso agora
              </p>
            </div>
          </a>

          {/* Grid — Suporte + Canal VIP */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={SUPPORT_WA}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-[2rem] flex flex-col items-center justify-center gap-2 transition-all hover:bg-[#f8fafc]"
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e8ecf1",
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#fafbfc", color: "#3b82f6" }}
              >
                <Headphones className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <span
                className="font-bold text-sm"
                style={{ fontFamily: "'Outfit', sans-serif", color: "#0f172a" }}
              >
                Suporte
              </span>
            </a>
            <a
              href={WHATSAPP_CHANNEL}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-[2rem] flex flex-col items-center justify-center gap-2 transition-all hover:bg-[#f8fafc]"
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e8ecf1",
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#fafbfc", color: "#3b82f6" }}
              >
                <Megaphone className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <span
                className="font-bold text-sm"
                style={{ fontFamily: "'Outfit', sans-serif", color: "#0f172a" }}
              >
                Canal VIP
              </span>
            </a>
          </div>
        </div>

        {/* Novos Lançamentos */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2
              className="font-extrabold text-lg flex items-center gap-2"
              style={{ fontFamily: "'Outfit', sans-serif", color: "#0f172a" }}
            >
              <Popcorn className="w-5 h-5" style={{ color: "#3b82f6" }} />
              Novos Lançamentos
            </h2>
          </div>
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              border: "1px solid #e8ecf1",
              backgroundColor: "#ffffff",
              boxShadow: "0 8px 20px -4px rgba(0,0,0,0.04)",
            }}
          >
            <LaunchesBanner />
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-4">
          <p
            className="text-[11px] font-medium tracking-wide"
            style={{ color: "#94a3b8" }}
          >
            © {new Date().getFullYear()} LOREALL PLAY TV • TODOS OS DIREITOS RESERVADOS
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Links;
