import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Download, ExternalLink, AlertTriangle, CheckCircle2,
  MessageCircle, ChevronDown, Tv, MonitorPlay, Smartphone, Laptop, Radio,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { WHATSAPP_NUMBER } from "@/utils/constants";
import imgSmartTv from "@/assets/dev-smarttv.png.asset.json";
import imgAndroidTv from "@/assets/dev-androidtv.png.asset.json";
import imgTvBox from "@/assets/dev-tvbox.png.asset.json";
import imgFireStick from "@/assets/dev-firestick.png.asset.json";
import imgCelular from "@/assets/dev-celular.png.asset.json";
import imgComputador from "@/assets/dev-computador.png.asset.json";
import imgWplayScreenshot from "@/assets/wplay-screenshot.png.asset.json";
import imgWplayProScreenshot from "@/assets/wplay-pro-screenshot.png.asset.json";

const logo = "/logo.png";

type App = {
  name: string;
  recommended?: boolean;
  singleScreen?: boolean;
  href?: string;
  hrefLabel?: string;
  note?: string;
  downloaderCode?: string;
  ntDownCode?: string;
  ntDownVersion?: string;
  screenshot?: string;
};

type Section = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  icon: React.ReactNode;
  accent: string;
  steps: string[];
  apps: App[];
  warning?: string;
};

const SECTIONS: Section[] = [
  {
    id: "smarttv",
    title: "Smart TVs Samsung, LG e Roku",
    subtitle: "Samsung (Tizen) · LG (webOS) · Roku TV",
    image: imgSmartTv.url,
    icon: <Tv className="h-4 w-4" />,
    accent: "from-sky-500/25 to-indigo-500/10 border-sky-500/25 text-sky-400",
    steps: [
      "Ligue a TV e conecte na sua internet (Wi-Fi ou cabo).",
      "Abra a loja de aplicativos da TV (Samsung Apps, LG Content Store ou Roku Channel Store).",
      "Busque pelo aplicativo recomendado abaixo e instale.",
      "Abra o app e escolha entre entrar com usuário e senha ou lista M3U.",
      "Digite seu usuário e senha da Loreall Play e confirme.",
      "Aguarde carregar a lista de canais — pode levar até 1 minuto na primeira vez.",
    ],
    apps: [
      { name: "Kplay", recommended: true, hrefLabel: "Em breve" },
      { name: "Blessed Player", recommended: true, hrefLabel: "Em breve" },
      { name: "Brasil IPTV", note: "Indicado para TVs LG webOS.", hrefLabel: "Em breve" },
    ],
    warning: "TVs Samsung, LG e Roku não aceitam apps de Android. Use apenas os players desta seção.",
  },
  {
    id: "androidtv",
    title: "Smart TVs Android / Google TV",
    subtitle: "TCL · Philips · Sony · Xiaomi · AOC (Android TV)",
    image: imgAndroidTv.url,
    icon: <Tv className="h-4 w-4" />,
    accent: "from-teal-500/25 to-emerald-500/10 border-teal-500/25 text-teal-400",
    steps: [
      "Conecte a TV na internet e finalize o login da conta Google.",
      "Na Play Store da TV, busque e instale o app Downloader (é gratuito — ele serve só pra instalar outros apps usando um código, sem precisar baixar arquivo nenhum).",
      "Abra o Downloader, digite o código do app escolhido abaixo em \"URL\" e toque em Ir.",
      "Aguarde instalar, abra o app e escolha login por usuário e senha.",
      "Informe seu usuário e senha da Loreall Play e aguarde a lista carregar.",
    ],
    apps: [
      {
        name: "Wplay P2P",
        recommended: true,
        singleScreen: true,
        downloaderCode: "2943496",
        ntDownCode: "44892",
        ntDownVersion: "11.8.6b",
        screenshot: imgWplayScreenshot.url,
      },
      {
        name: "P2P PRO",
        singleScreen: true,
        note: "Mesmo usuário e senha do Wplay P2P.",
        downloaderCode: "1362324",
        ntDownCode: "21241",
        screenshot: imgWplayProScreenshot.url,
      },
      { name: "Blessed Player", recommended: true, hrefLabel: "Em breve" },
    ],
    warning: "Se a sua TV tem Google Play Store, ela é Android TV — use os apps desta seção, não os de Samsung/LG.",
  },

  {
    id: "tvbox",
    title: "TV Box",
    subtitle: "Android · BTV · MXQ · H96",
    image: imgTvBox.url,
    icon: <MonitorPlay className="h-4 w-4" />,
    accent: "from-violet-500/25 to-fuchsia-500/10 border-violet-500/25 text-violet-400",
    steps: [
      "Conecte o TV Box na TV pelo cabo HDMI, ligue na tomada e conecte na internet.",
      "Na Play Store do aparelho, busque e instale o app Downloader (é gratuito — ele serve só pra instalar outros apps usando um código, sem precisar baixar arquivo nenhum).",
      "Abra o Downloader, digite o código do app escolhido abaixo em \"URL\" e toque em Ir.",
      "Aguarde instalar, abra o app e escolha login por usuário e senha.",
      "Informe seu usuário e senha da Loreall Play e aguarde a lista carregar.",
    ],
    apps: [
      {
        name: "Wplay P2P",
        recommended: true,
        singleScreen: true,
        downloaderCode: "2943496",
        ntDownCode: "44892",
        ntDownVersion: "11.8.6b",
        screenshot: imgWplayScreenshot.url,
      },
      {
        name: "P2P PRO",
        singleScreen: true,
        note: "Mesmo usuário e senha do Wplay P2P.",
        downloaderCode: "1362324",
        ntDownCode: "21241",
        screenshot: imgWplayProScreenshot.url,
      },
      { name: "Blessed Player", recommended: true, hrefLabel: "Em breve" },
    ],
    warning: "O Wplay P2P funciona em apenas 1 tela por vez. Para assistir em mais aparelhos ao mesmo tempo, use outro app da lista.",
  },
  {
    id: "firestick",
    title: "Fire Stick",
    subtitle: "Amazon Fire TV Stick",
    image: imgFireStick.url,
    icon: <Radio className="h-4 w-4" />,
    accent: "from-orange-500/25 to-amber-500/10 border-orange-500/25 text-orange-400",
    steps: [
      "Encaixe o Fire Stick na entrada HDMI da TV e ligue a fonte de energia.",
      "Conecte o aparelho ao Wi-Fi e finalize o login da conta Amazon.",
      "Vá em Configurações › Meu Fire TV › Opções de desenvolvedor e ative “Apps de fontes desconhecidas”.",
      "Instale o app Downloader pela loja da Amazon e abra.",
      "Digite o link do APK do player recomendado e confirme a instalação.",
      "Abra o player, entre com usuário e senha e aguarde a lista carregar.",
    ],
    apps: [
      { name: "Blessed Player", recommended: true, hrefLabel: "Em breve" },
      { name: "Wplay P2P", singleScreen: true, hrefLabel: "Em breve" },
    ],
    warning: "Sem ativar “fontes desconhecidas” o Fire Stick bloqueia a instalação do player.",
  },
  {
    id: "celular",
    title: "Celulares",
    subtitle: "Android 6+ · iPhone e iPad",
    image: imgCelular.url,
    icon: <Smartphone className="h-4 w-4" />,
    accent: "from-emerald-500/25 to-teal-500/10 border-emerald-500/25 text-emerald-400",
    steps: [
      "No iPhone, abra a App Store; no Android, use o link do APK abaixo.",
      "Instale o aplicativo recomendado para o seu celular.",
      "No Android, autorize a instalação de apps do navegador quando for solicitado.",
      "Abra o app e selecione login por usuário e senha (Xtream Codes).",
      "Informe seu usuário e senha da Loreall Play.",
      "Pronto: use Wi-Fi ou 4G/5G com boa estabilidade para evitar travamentos.",
    ],
    apps: [
      {
        name: "Wplay Mobile (iPhone)",
        recommended: true,
        href: "https://apps.apple.com/br/app/wplay-mobile/id6471241842",
        hrefLabel: "Abrir App Store",
        note: "Pode ser usado junto com outros dispositivos.",
      },
      {
        name: "Wapp Mobile (Android)",
        recommended: true,
        href: "https://tinyurl.com/2yykksed",
        hrefLabel: "Baixar APK",
        note: "Recomendado se você já usa o Wplay na TV ou TV Box.",
      },
      { name: "Wplay Mobile (Android)", singleScreen: true, hrefLabel: "Em breve" },
    ],
    warning: "O Wplay permite 1 tela por vez. Se ele já estiver aberto na TV, use o Wapp Mobile no celular.",
  },
  {
    id: "computador",
    title: "Computador",
    subtitle: "Windows · macOS · Linux",
    image: imgComputador.url,
    icon: <Laptop className="h-4 w-4" />,
    accent: "from-cyan-500/25 to-blue-500/10 border-cyan-500/25 text-cyan-400",
    steps: [
      "Baixe e instale o VLC Media Player no seu computador.",
      "Peça sua lista M3U ao suporte pelo WhatsApp (envio na hora).",
      "Abra o VLC e vá em Mídia › Abrir Fluxo de Rede.",
      "Cole o link da sua lista M3U e clique em Reproduzir.",
      "Para ver o guia de canais, use o IPTV Smarters para PC com usuário e senha.",
    ],
    apps: [
      {
        name: "VLC Media Player",
        recommended: true,
        href: "https://www.videolan.org/vlc/",
        hrefLabel: "Baixar VLC",
        note: "Grátis, funciona em Windows, macOS e Linux.",
      },
    ],
  },
];

const Instalacao = () => {
  const navigate = useNavigate();
  const { customer } = useAuthStore();
  const [openId, setOpenId] = useState<string | null>("smarttv");
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card/80 backdrop-blur-md sticky top-0 z-10 border-b border-border">
        <div className="flex items-center justify-between px-4 py-2.5 max-w-[520px] mx-auto">
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
            <span className="text-sm font-semibold text-foreground">Como instalar</span>
          </div>
          <div style={{ width: 40 }} />
        </div>
      </header>

      <main className="px-4 py-4 max-w-[520px] mx-auto space-y-5">
        <section className="card-elevated p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent" />
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            {customer?.product?.name ? `Servidor ${customer.product.name}` : "Guia de instalação"}
          </p>
          <h1 className="text-xl font-bold text-foreground leading-tight">Selecione seu dispositivo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Toque na seção do seu aparelho e siga o passo a passo. Leva menos de 5 minutos.
          </p>
          {customer?.usuario && (
            <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Seu usuário de acesso
              </p>
              <p className="text-sm font-mono font-semibold text-foreground mt-0.5 break-all">
                {customer.usuario}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Use este usuário com a sua senha em qualquer aplicativo abaixo.
              </p>
            </div>
          )}
        </section>

        <div className="space-y-4">
          {SECTIONS.map((s) => {
            const isOpen = openId === s.id;
            return (
              <section key={s.id} className="card-elevated overflow-hidden">
                <button
                  onClick={() => setOpenId(isOpen ? null : s.id)}
                  className="w-full text-left"
                  aria-expanded={isOpen}
                >
                  <div className={`relative bg-gradient-to-br ${s.accent} border-b border-border/60`}>
                    <img
                      src={s.image}
                      alt={`${s.title} — ${s.subtitle}`}
                      className="w-full h-40 object-contain p-3"
                      loading="lazy"
                      width={1024}
                      height={768}
                    />
                  </div>
                  <div className="flex items-center gap-3 p-4">
                    <div className={`rounded-xl p-2.5 bg-gradient-to-br ${s.accent} border`}>{s.icon}</div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-bold text-foreground leading-tight">{s.title}</h2>
                      <p className="text-[11px] text-muted-foreground">{s.subtitle}</p>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-4">
                    {s.warning && (
                      <div className="flex items-start gap-2 rounded-lg p-2.5 bg-warning/10 border border-warning/20">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "hsl(var(--warning))" }} />
                        <p className="text-[11px] text-foreground leading-snug">{s.warning}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Passo a passo
                      </p>
                      <ol className="space-y-2">
                        {s.steps.map((step, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="shrink-0 h-6 w-6 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            <p className="text-[13px] text-foreground leading-snug pt-0.5">{step}</p>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Aplicativos
                      </p>
                      <div className="space-y-2">
                        {s.apps.map((app) => {
                          const isLink = !!app.href;
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
                                    <span
                                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-warning/15"
                                      style={{ color: "hsl(var(--warning))" }}
                                    >
                                      1 TELA
                                    </span>
                                  )}
                                </div>
                                {app.note && (
                                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{app.note}</p>
                                )}
                                {app.downloaderCode && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Código:</span>
                                    <span className="text-[13px] font-mono font-bold text-primary">{app.downloaderCode}</span>
                                    {app.screenshot && (
                                      <button
                                        type="button"
                                        onClick={() => setPreviewImg(app.screenshot!)}
                                        className="ml-auto text-[10px] font-semibold text-muted-foreground underline underline-offset-2"
                                      >
                                        Ver tela do app
                                      </button>
                                    )}
                                  </div>
                                )}
                                {app.ntDownCode && (
                                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                    Downloader não funcionou? ntDown, código {app.ntDownCode}
                                    {app.ntDownVersion && ` (versão ${app.ntDownVersion})`}
                                  </p>
                                )}
                              </div>

                              {isLink ? (
                                <a
                                  href={app.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                                  style={{ minHeight: 40 }}
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
                                  style={{ minHeight: 40 }}
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
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <section className="card-elevated p-4">
          <h2 className="text-sm font-bold text-foreground mb-1">Ainda com dúvida na instalação?</h2>
          <p className="text-[12px] text-muted-foreground mb-3">
            Nossa equipe instala junto com você pelo WhatsApp, passo a passo.
          </p>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
              `Olá! Preciso de ajuda para instalar o aplicativo. Usuário: ${customer?.usuario || ""}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary-gradient w-full py-3 font-semibold text-sm inline-flex items-center justify-center gap-2 rounded-lg"
            style={{ minHeight: 48 }}
          >
            <MessageCircle className="h-4 w-4" />
            Falar com o suporte
          </a>
        </section>

        <div className="h-4" />
      </main>

      {previewImg && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"
          onClick={() => setPreviewImg(null)}
        >
          <img src={previewImg} alt="Tela do app" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  );
};

export default Instalacao;
