import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy, CheckCircle2, AlertCircle, Zap, RefreshCw, MessageCircle, Minus, Plus, ExternalLink } from "lucide-react";
import loreallLogo from "@/assets/loreall-play-logo.png";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPPORT_WHATSAPP = "5583998551952";
const WAREZ_PANEL_URL = "https://wwpanel.link/";

interface ResellerLink {
  id: string;
  slug: string;
  display_name: string;
  warez_username: string;
  warez_user_id: number;
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
  const [link, setLink] = useState<ResellerLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // email removed — Fast Depix gets a synthetic fallback in the edge function
  const [credits, setCredits] = useState<number>(10);
  const [generating, setGenerating] = useState(false);

  const [pix, setPix] = useState<PixData | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);

  const countdown = useCountdown(pix?.expires_at);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("reseller_links")
        .select("*")
        .eq("slug", slug.toLowerCase())
        .eq("is_active", true)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) setNotFound(true);
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
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-8 max-w-sm text-center">
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
    `Olá, suporte Loreall Play! Preciso de ajuda com a recarga do painel ${link.warez_username} (ID ${link.warez_user_id}).`,
  )}`;

  return (
    <div className="relative min-h-screen px-4 py-8 text-gray-900 overflow-hidden bg-white">
      {/* Animated Loreall blue rising background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-blue-50 to-white" />
        <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[140%] h-[80vh] rounded-[50%] bg-gradient-to-t from-blue-600/30 via-indigo-500/15 to-transparent blur-3xl animate-loreall-rise" />
        <div className="absolute -bottom-40 left-[20%] w-[60%] h-[70vh] rounded-[50%] bg-gradient-to-t from-indigo-600/25 to-transparent blur-3xl animate-loreall-rise-slow" />
      </div>

      <div className="max-w-md mx-auto space-y-6 relative">
        <div className="text-center">
          <img src={loreallLogo} alt="Loreall Play" className="h-24 w-24 mx-auto mb-3 object-contain drop-shadow-xl" />
          <div className="text-xl font-bold tracking-tight text-gray-900">Loreall Play</div>
          <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 rounded-full bg-blue-600/10 text-blue-700 text-xs font-semibold">
            <Zap className="h-3.5 w-3.5" /> Recarga de Créditos
          </div>
          <h1 className="text-2xl font-bold mt-3">{link.display_name}</h1>
          <p className="text-sm text-gray-600 mt-1">
            Painel: <span className="font-mono">{link.warez_username}</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            ID: <span className="font-mono">{link.warez_user_id}</span>
          </p>
        </div>

        <a
          href={WAREZ_PANEL_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm font-semibold shadow-sm"
        >
          <ExternalLink className="h-4 w-4" /> Abrir painel WAREZ
        </a>


        {!pix && (
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-5">
            <div className="text-center py-5 border border-gray-200 rounded-xl bg-gray-50">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Quantidade de créditos</div>
              <div className="flex items-center justify-center gap-4 mt-3">
                <button
                  onClick={() => stepCredits(-1)}
                  disabled={credits <= link.min_credits}
                  className="h-10 w-10 rounded-full border border-gray-300 text-gray-700 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40"
                  aria-label="Diminuir"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="text-5xl font-bold text-blue-600 tabular-nums w-20">{credits}</div>
                <button
                  onClick={() => stepCredits(1)}
                  disabled={credits >= link.max_credits}
                  className="h-10 w-10 rounded-full border border-gray-300 text-gray-700 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40"
                  aria-label="Aumentar"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Mín. {link.min_credits} • Máx. {link.max_credits} créditos
              </div>
              <div className="mt-4 text-3xl font-bold text-gray-900">{formatBRL(totalAmount)}</div>
              <div className="text-xs text-gray-500 mt-1">
                {formatBRL(Number(link.price_per_credit))} por crédito
              </div>
            </div>


            <button
              onClick={generatePix}
              disabled={generating}
              className="w-full py-3.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold text-sm hover:opacity-95 disabled:opacity-60"
            >
              {generating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Gerando PIX...
                </span>
              ) : (
                `Recarregar painel • ${formatBRL(totalAmount)}`
              )}
            </button>
          </div>
        )}

        {pix && !isRecharged && !isExpired && (
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-4">
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
                Pagamento em análise pela Fast Depix...
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
          </div>
        )}

        {isRecharged && (
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Créditos adicionados!</h2>
            <p className="text-sm text-gray-600">
              +{pix?.package_credits} créditos no painel{" "}
              <span className="font-mono text-gray-900">{pix?.warez_username}</span>.
            </p>
            <button onClick={reset} className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold text-sm">
              Recarregar novamente
            </button>
          </div>
        )}

        {isExpired && (
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="text-lg font-bold text-gray-900">PIX expirado</h2>
            <button onClick={reset} className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold text-sm">
              Gerar novo PIX
            </button>
          </div>
        )}

        <a
          href={supportUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border border-green-500 text-green-600 hover:bg-green-50 text-sm font-medium"
        >
          <MessageCircle className="h-4 w-4" /> Suporte Loreall Play
        </a>
        <p className="text-center text-xs text-gray-400">© Loreall Play</p>
      </div>
    </div>
  );
}
