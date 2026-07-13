import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Download, ExternalLink, Tv, Smartphone, MonitorPlay,
  AlertTriangle, CheckCircle2, Apple, Search
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
const logo = "/logo.png";

type Platform = "samsung" | "lg" | "roku" | "tcl" | "tvbox" | "iphone" | "android";

type App = {
  name: string;
  recommended?: boolean;
  singleScreen?: boolean; // Wplay P2P só 1 tela
  href?: string;          // link direto ou store
  hrefLabel?: string;     // "Baixar APK" / "App Store" / "Em breve"
  note?: string;
};

type Device = {
  id: Platform;
  title: string;
  icon: React.ReactNode;
  subtitle: string;
  apps: App[];
  warning?: string;
};

const DEVICES: Device[] = [
  {
    id: "samsung",
    title: "Samsung",
    subtitle: "Smart TV Tizen",
    icon: <Tv className="h-5 w-5" />,
    apps: [
      { name: "Kplay", recommended: true, hrefLabel: "Em breve" },
      { name: "Blessed Player", recommended: true, hrefLabel: "Em breve" },
    ],
  },
  {
    id: "lg",
    title: "LG",
    subtitle: "Smart TV webOS",
    icon: <Tv className="h-5 w-5" />,
    apps: [
      { name: "Brasil IPTV", recommended: true, hrefLabel: "Em breve" },
      { name: "Blessed Player", recommended: true, hrefLabel: "Em breve" },
    ],
  },
  {
    id: "roku",
    title: "Roku TV",
    subtitle: "Roku OS",
    icon: <MonitorPlay className="h-5 w-5" />,
    apps: [
      { name: "Wapp TV", recommended: true, hrefLabel: "Em breve" },
      { name: "Kplay", recommended: true, hrefLabel: "Em breve" },
    ],
  },
  {
    id: "tcl",
    title: "TCL",
    subtitle: "Android TV / Google TV",
    icon: <Tv className="h-5 w-5" />,
    apps: [
      { name: "Wplay P2P", recommended: true, singleScreen: true, hrefLabel: "Em breve" },
      { name: "Blessed Player", recommended: true, hrefLabel: "Em breve" },
    ],
    warning: "Wplay P2P só funciona em 1 tela por vez. Para telas simultâneas, use outro app da lista.",
  },
  {
    id: "tvbox",
    title: "TV Box",
    subtitle: "Android",
    icon: <MonitorPlay className="h-5 w-5" />,
    apps: [
      { name: "Wplay P2P", recommended: true, singleScreen: true, hrefLabel: "Em breve" },
      { name: "Blessed Player", recommended: true, hrefLabel: "Em breve" },
    ],
    warning: "Wplay P2P só funciona em 1 tela por vez. Para telas simultâneas, use outro app da lista.",
  },
  {
    id: "iphone",
    title: "iPhone",
    subtitle: "iOS / iPadOS",
    icon: <Apple className="h-5 w-5" />,
    apps: [
      {
        name: "Wplay Mobile",
        recommended: true,
        href: "https://apps.apple.com/br/app/wplay-mobile/id6471241842",
        hrefLabel: "Abrir App Store",
        note: "IPTV — pode usar simultaneamente com outros dispositivos.",
      },
    ],
  },
  {
    id: "android",
    title: "Celular Android",
    subtitle: "Android 6+",
    icon: <Smartphone className="h-5 w-5" />,
    apps: [
      { name: "Wplay Mobile", recommended: true, singleScreen: true, hrefLabel: "Em breve" },
      {
        name: "Wapp Mobile",
        recommended: true,
        href: "https://tinyurl.com/2yykksed",
        hrefLabel: "Baixar APK",
        note: "Recomendado se já estiver usando Wplay na TV/TV Box.",
      },
    ],
    warning: "Wplay só permite 1 tela por vez. Se já estiver usando na TCL ou TV Box, use o Wapp Mobile no celular.",
  },
];

const Instalacao = () => {
  const navigate = useNavigate();
  const { customer } = useAuthStore();
  const [query, setQuery] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DEVICES;
    return DEVICES.filter(
      d =>
        d.title.toLowerCase().includes(q) ||
        d.subtitle.toLowerCase().includes(q) ||
        d.apps.some(a => a.name.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card/80 backdrop-blur-md sticky top-0 z-10 border-b border-border">
        <div className="flex items-center justify-between px-4 py-2.5 max-w-[480px] mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Voltar"
            style={{ minHeight: 40, minWidth: 40 }}
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <img src={logo} alt="Loreall Play TV" style={{ height: 28, width: "auto" }} />
            <span className="text-sm font-semibold text-foreground">Instalação</span>
          </div>
          <div style={{ width: 40 }} />
        </div>
      </header>

      <main className="px-4 py-4 max-w-[480px] mx-auto space-y-4">
        {/* Hero */}
        <div className="card-elevated p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent" />
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            {customer?.product?.name ? `Servidor ${customer.product.name}` : "Guia de instalação"}
          </p>
          <h1 className="text-xl font-bold text-foreground leading-tight">
            Escolha seu dispositivo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Baixe o app recomendado para sua TV, TV Box ou celular.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar dispositivo ou app…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Devices */}
        <div className="space-y-3">
          {filtered.map((d) => (
            <section key={d.id} className="card-elevated p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-xl p-2.5 bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 text-primary">
                  {d.icon}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-foreground leading-tight">{d.title}</h2>
                  <p className="text-[11px] text-muted-foreground">{d.subtitle}</p>
                </div>
              </div>

              {d.warning && (
                <div className="flex items-start gap-2 rounded-lg p-2.5 mb-3 bg-warning/10 border border-warning/20">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "hsl(var(--warning))" }} />
                  <p className="text-[11px] text-foreground leading-snug">{d.warning}</p>
                </div>
              )}

              <div className="space-y-2">
                {d.apps.map((app) => {
                  const isLink = !!app.href;
                  const disabled = !isLink;
                  return (
                    <div
                      key={app.name}
                      className="rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{app.name}</p>
                          {app.recommended && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5">
                              <CheckCircle2 className="h-2.5 w-2.5" /> RECOMENDADO
                            </span>
                          )}
                          {app.singleScreen && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-warning/15" style={{ color: "hsl(var(--warning))" }}>
                              1 TELA
                            </span>
                          )}
                        </div>
                        {app.note && (
                          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{app.note}</p>
                        )}
                      </div>

                      {isLink ? (
                        <a
                          href={app.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                          style={{ minHeight: 36 }}
                        >
                          {app.href?.startsWith("https://apps.apple.com") ? (
                            <ExternalLink className="h-3.5 w-3.5" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          {app.hrefLabel || "Baixar"}
                        </a>
                      ) : (
                        <button
                          disabled
                          className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
                          style={{ minHeight: 36 }}
                          title="APK em breve"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {app.hrefLabel || "Em breve"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              Nenhum dispositivo encontrado.
            </div>
          )}
        </div>

        <div className="text-[11px] text-muted-foreground text-center px-2 pt-2">
          Precisa de ajuda? Fale com o suporte pelo WhatsApp na sua área do cliente.
        </div>

        <div className="h-4" />
      </main>
    </div>
  );
};

export default Instalacao;
