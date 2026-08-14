import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy, CheckCircle2, AlertCircle, Zap, RefreshCw, MessageCircle, Minus, Plus, ExternalLink, Menu, Sparkles, Film, Play, Sun, Moon, Lock } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import loreallLogo from "@/assets/loreall-play-logo.png";
import topgestorLogo from "@/assets/topgestor-logo.png";
import geradorProLogo from "@/assets/gerador-pro-logo.png";
import LaunchesBanner from "@/components/LaunchesBanner";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { useLoginFlow } from "@/features/auth/hooks/useLoginFlow";
import { useAuthStore } from "@/store/authStore";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPPORT_WHATSAPP = "5583998551952";
const WAREZ_PANEL_URL = "https://revenda.loreallplay.com/";

interface ResellerLink {
  id: string;
  slug: string;
  display_name: string;
  credits: number;
  amount: number;
  is_active: boolean;
  price_per_credit: number;
  min_credits: number;
  max_credits: number;
}

interface PixData {
  purchase_id: string;
  qr_code_url: string;
  qr_code_text: string;
  expires_at: string;
  amount: number;
  package_credits: number;
  warez_username: string;
}

interface StatusData {
  id: string;
  status: string;
  recharge_status: string;
  warez_response?: {
    adjustment_applied?: boolean;
    adjustment_delta?: number;
    credits_sent?: number;
    note?: string | null;
  } | null;
  error_message: string | null;
  under_review?: boolean;
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function useCountdown(expiresAt: string | null | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return "00:00";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Revendedor() {
  const { slug } = useParams<{ slug: string }>();
  const customer = useAuthStore((s) => s.customer);
  const isAuthenticated = !!customer && customer.role === "reseller" && customer.slug === slug;

  const {
    phone, setPhone, code, setCode, step, setStep, resendIn, loading: loginLoading,
    targetHint, customerName, sendCode, handleSubmit
  } = useLoginFlow("reseller", slug);

  const [link, setLink] = useState<ResellerLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [credits, setCredits] = useState<number>(10);
  const [generating, setGenerating] = useState(false);

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("revendedor-theme") as "light" | "dark") || "light";
  });
  useEffect(() => {
    localStorage.setItem("revendedor-theme", theme);
  }, [theme]);
  const isDark = theme === "dark";

  const [pix, setPix] = useState<PixData | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);

  const countdown = useCountdown(pix?.expires_at);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supaUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supaUrl}/functions/v1/reseller-link-info?slug=${encodeURIComponent(slug.toLowerCase())}`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      const data = res.ok ? await res.json() : null;
      if (cancelled) return;
      if (!data) setNotFound(true);
      else {
        const l = data as ResellerLink;
        setLink(l);
        setCredits(Number(l.min_credits || 10));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!pix) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(
          `${SUPABASE_URL}/functions/v1/reseller-check-status?id=${pix.purchase_id}`,
          { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
        );
        const data = (await r.json()) as StatusData;
        if (stop) return;
        setStatus(data);
        if (data.recharge_status === "recharged" || data.status === "expired") {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch (e) {
        console.error("poll error", e);
      }
    };
    tick();
    pollRef.current = window.setInterval(tick, 3000);
    return () => {
      stop = true;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [pix]);

  const totalAmount = useMemo(() => {
    if (!link) return 0;
    return Number((credits * Number(link.price_per_credit || 0)).toFixed(2));
  }, [credits, link]);

  const stepCredits = (delta: number) => {
    if (!link) return;
    const next = Math.max(link.min_credits, Math.min(link.max_credits, credits + delta));
    setCredits(next);
  };

  const generatePix = async () => {
    if (!link) return;
    setGenerating(true);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/reseller-create-pix`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ slug: link.slug, credits }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `Erro ${r.status}`);
      setPix(data as PixData);
      setStatus(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar PIX");
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = async () => {
    if (!pix?.qr_code_text) return;
    await navigator.clipboard.writeText(pix.qr_code_text);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setPix(null);
    setStatus(null);
  };

  const retryRecharge = async () => {
    if (!pix) return;
    toast.info("Reprocessando recarga...");
    await fetch(`${SUPABASE_URL}/functions/v1/reseller-check-status?id=${pix.purchase_id}`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
  };

  const isRecharged = status?.recharge_status === "recharged";
  const isFailed = status?.recharge_status === "failed";
  const isExpired = status?.status === "expired";
  const underReview = status?.under_review;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (notFound || !link) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm rounded-2xl p-8 max-w-sm text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Revendedor não encontrado</h1>
          <p className="text-sm text-gray-600">
            O link <code className="font-mono">{slug}</code> não está ativo ou não existe.
          </p>
        </div>
      </div>
    );
  }

  const supportUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
    `Olá, suporte Loreall Play! Preciso de ajuda com a recarga do link de revenda ${link.display_name} (${link.slug}).`,
  )}`;

  return (
    <div className={isDark ? "dark" : ""}>
    <div className="relative min-h-screen flex items-start justify-center text-slate-900 dark:text-slate-100 overflow-hidden bg-slate-50 dark:bg-slate-950 font-['Inter',system-ui,sans-serif] transition-colors">
      {/* Background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-blue-50/50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[150%] h-[500px] bg-blue-400/15 dark:bg-blue-600/20 blur-[120px] rounded-[100%]" />
      </div>

      <div className="w-full max-w-md px-5 pt-3 pb-6 flex flex-col gap-4 relative">
        {!isAuthenticated ? (
          <div className="flex flex-col gap-6 pt-10">
            <div className="flex flex-col items-center gap-3 text-center">
              <img src={loreallLogo} alt="Loreall Play" className="h-16 w-16 object-contain drop-shadow-xl" />
              <div className="space-y-1">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Área do <span className="text-blue-600">Revendedor</span>
                </h1>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {link.display_name}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/50 dark:border-slate-800 shadow-2xl shadow-blue-900/10">
              <LoginForm 
                step={step}
                phone={phone}
                code={code}
                loading={loginLoading}
                resendIn={resendIn}
                refCode={null}
                targetHint={targetHint}
                customerName={customerName}
                onPhoneChange={setPhone}
                onCodeChange={setCode}
                onSendCode={sendCode}
                onBackToPhone={() => { setStep("phone"); setCode(""); }}
                onSubmit={handleSubmit}
              />
            </div>

            <div className="flex flex-col items-center gap-2">
              <p className="text-[10px] text-slate-400 font-medium inline-flex items-center gap-1.5 uppercase tracking-widest">
                <Lock className="w-3 h-3" /> Acesso Restrito e Criptografado
              </p>
            </div>
          </div>
        ) : (
          <>
        {/* Top bar */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              <Menu className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Menu</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={WAREZ_PANEL_URL} target="_blank" rel="noreferrer" className="cursor-pointer">
                  <ExternalLink className="h-4 w-4 mr-2 text-blue-600" /> Painel de Revenda
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={supportUrl} target="_blank" rel="noreferrer" className="cursor-pointer">
                  <MessageCircle className="h-4 w-4 mr-2 text-green-600" /> Suporte Loreall Play
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <img src={loreallLogo} alt="Loreall Play" className="h-10 w-10 object-contain shrink-0 drop-shadow" />
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-extrabold text-slate-900 dark:text-slate-50 leading-tight truncate">{link.display_name}</h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider truncate">
                Recarga de créditos
              </p>
            </div>
          </div>

          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="h-9 px-3 shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-yellow-300 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label={isDark ? "Modo claro" : "Modo escuro"}
            title={isDark ? "Modo claro" : "Modo escuro"}
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>




        {!pix && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-2.5 border border-slate-100 dark:border-slate-800 shadow-md shadow-blue-900/5 dark:shadow-black/40">
            <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl px-3 py-3 border border-slate-100 dark:border-slate-800 flex flex-col items-center">
              <h3 className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 tracking-[0.18em] uppercase mb-2 inline-flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> Recarga de Créditos
              </h3>

              <div className="flex items-center justify-between w-full mb-2">
                <button
                  onClick={() => stepCredits(-1)}
                  disabled={credits <= link.min_credits}
                  className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-400 hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-500 transition-all active:scale-95 disabled:opacity-40"
                  aria-label="Diminuir"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <span className="text-4xl font-black text-blue-600 dark:text-blue-400 tabular-nums select-none tracking-tighter">{credits}</span>

                <button
                  onClick={() => stepCredits(1)}
                  disabled={credits >= link.max_credits}
                  className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-800 dark:text-slate-100 hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-500 transition-all active:scale-95 disabled:opacity-40"
                  aria-label="Aumentar"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Slider para controle preciso */}
              <input
                type="range"
                min={link.min_credits}
                max={link.max_credits}
                step={1}
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
                className="w-full h-1.5 mb-2 rounded-full appearance-none cursor-pointer accent-blue-600
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600
                  [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white dark:[&::-webkit-slider-thumb]:border-slate-900"
                style={{
                  background: `linear-gradient(to right, hsl(217 91% 60%) 0%, hsl(217 91% 60%) ${
                    ((credits - link.min_credits) / (link.max_credits - link.min_credits)) * 100
                  }%, ${isDark ? "rgb(51 65 85)" : "rgb(226 232 240)"} ${
                    ((credits - link.min_credits) / (link.max_credits - link.min_credits)) * 100
                  }%, ${isDark ? "rgb(51 65 85)" : "rgb(226 232 240)"} 100%)`,
                }}
              />

              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  {link.min_credits}–{link.max_credits} · {formatBRL(Number(link.price_per_credit))}/cr
                </span>
                <span className="text-xl font-extrabold text-slate-900 dark:text-slate-50">{formatBRL(totalAmount)}</span>
              </div>
            </div>


            <button
              onClick={generatePix}
              disabled={generating}
              className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 rounded-xl text-white font-bold text-sm shadow-md shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:hover:scale-100"
            >
              {generating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Gerando PIX...
                </span>
              ) : (
                <>
                  Recarregar painel
                  <span className="opacity-50 text-sm font-normal">•</span>
                  {formatBRL(totalAmount)}
                </>
              )}
            </button>
          </div>
        )}

        {/* Mini tools row */}
        {!pix && (
          <div className="grid grid-cols-2 gap-4">
            <a
              href="https://topgestor.com/register?referralCode=8e486037-dd89-4ca3-89a7-3672cd47b59b"
              target="_blank"
              rel="noreferrer"
              className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div className="bg-slate-900 h-20 flex items-center justify-center p-3">
                <img src={topgestorLogo} alt="TopGestor" className="max-h-14 object-contain" />
              </div>
              <div className="p-3">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mb-2">Gestão de clientes IPTV automática.</p>
                <span className="text-blue-600 text-xs font-bold inline-flex items-center gap-1">
                  7 dias grátis <ExternalLink className="h-3 w-3" />
                </span>
              </div>
            </a>

            <a
              href="https://gerador.pro/link.php?ref=c6863f0f"
              target="_blank"
              rel="noreferrer"
              className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div className="bg-slate-900 h-20 flex items-center justify-center p-3">
                <img src={geradorProLogo} alt="Gerador Pro" className="max-h-16 object-contain" />
              </div>
              <div className="p-3">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mb-2">Banners e vídeos de divulgação.</p>
                <span className="text-blue-600 text-xs font-bold inline-flex items-center gap-1">
                  Teste 1 dia <ExternalLink className="h-3 w-3" />
                </span>
              </div>
            </a>
          </div>
        )}

        {/* Banner Lançamentos Loreall Play */}
        {/* Banner Lançamentos Loreall Play */}
        {!pix && <LaunchesBanner />}







        {pix && !isRecharged && !isExpired && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm rounded-2xl p-6 space-y-4">
            <div className="text-center">
              <div className="text-xs text-gray-500">Valor</div>
              <div className="text-2xl font-bold text-gray-900">{formatBRL(Number(pix.amount))}</div>
              <div className="text-xs text-gray-500 mt-1">
                {pix.package_credits} créditos para {pix.warez_username}
              </div>
            </div>

            {pix.qr_code_url && (
              <div className="flex justify-center bg-white p-4 rounded-xl border border-gray-200">
                <img src={pix.qr_code_url} alt="QR Code PIX" className="w-56 h-56" />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-600">Código copia-e-cola</label>
              <div className="mt-1 flex gap-2">
                <input
                  readOnly
                  value={pix.qr_code_text || ""}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 text-xs font-mono truncate"
                />
                <button
                  onClick={copyCode}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:opacity-90 transition"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Expira em</span>
              <span className="font-mono font-semibold text-gray-900">{countdown ?? "--:--"}</span>
            </div>

            {underReview && (
              <div className="text-xs text-center text-amber-700 bg-amber-50 rounded-lg py-2 px-3">
                Pagamento em análise...
              </div>
            )}
            {status?.status === "paid" && !isRecharged && !isFailed && (
              <div className="text-xs text-center text-blue-700 bg-blue-50 rounded-lg py-2 px-3 inline-flex items-center justify-center gap-2 w-full">
                <Loader2 className="h-3 w-3 animate-spin" /> Pagamento confirmado, processando recarga...
              </div>
            )}
            {isFailed && (
              <div className="space-y-2">
                <div className="text-xs text-red-700 bg-red-50 rounded-lg py-2 px-3">
                  Erro na recarga: {status?.error_message || "desconhecido"}
                </div>
                <button onClick={retryRecharge} className="w-full py-2 rounded-lg bg-gray-100 text-gray-900 text-sm font-medium hover:bg-gray-200 inline-flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4" /> Tentar novamente
                </button>
              </div>
            )}
            {!status && (
              <p className="text-xs text-center text-gray-500">
                Aguardando pagamento... abra o app do banco e pague via PIX.
              </p>
            )}

            {!isFailed && (
              <button
                onClick={reset}
                className="w-full py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-semibold hover:bg-slate-50 hover:text-slate-900 transition"
              >
                Cancelar e alterar valor
              </button>
            )}
          </div>
        )}


        {isRecharged && (() => {
          const adj = status?.warez_response;
          const hasAdjustment = adj?.adjustment_applied && typeof adj?.adjustment_delta === "number" && adj.adjustment_delta !== 0;
          const creditsSent = typeof adj?.credits_sent === "number" ? adj.credits_sent : pix?.package_credits;
          return (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm rounded-2xl p-8 text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Créditos adicionados!</h2>
              <p className="text-sm text-gray-600 dark:text-slate-300">
                +{creditsSent} créditos no painel{" "}
                <span className="font-mono text-gray-900 dark:text-white">{pix?.warez_username}</span>.
              </p>
              {hasAdjustment && (
                <div className="text-left rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    ⚠️ Ajuste aplicado nesta recarga
                  </p>
                  <p className="text-xs text-amber-800/90 dark:text-amber-200/90 leading-snug">
                    Foram descontados <strong>{Math.abs(adj!.adjustment_delta!)} crédito(s)</strong> referentes a uma recarga anterior creditada em duplicidade no painel Warez. Por isso você recebeu {creditsSent} em vez de {pix?.package_credits} créditos nesta compra.
                  </p>
                  {adj?.note && (
                    <p className="text-[10px] text-amber-700/80 dark:text-amber-300/70 mt-1">
                      {adj.note}
                    </p>
                  )}
                </div>
              )}
              <button onClick={reset} className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold text-sm">
                Recarregar novamente
              </button>
            </div>
          );
        })()}

        {isExpired && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm rounded-2xl p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="text-lg font-bold text-gray-900">PIX expirado</h2>
            <button onClick={reset} className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold text-sm">
              Gerar novo PIX
            </button>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-400 dark:text-slate-600">© Loreall Play</p>
          </>
        )}
      </div>
    </div>
    </div>
  );
}
