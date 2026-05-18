import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy, CheckCircle2, AlertCircle, Zap, RefreshCw } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface ResellerLink {
  id: string;
  slug: string;
  display_name: string;
  warez_username: string;
  warez_user_id: number;
  credits: number;
  amount: number;
  is_active: boolean;
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
  qr_code_url?: string;
  qr_code_text?: string;
  qr_code_expires_at?: string;
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

  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [generating, setGenerating] = useState(false);

  const [pix, setPix] = useState<PixData | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);

  const countdown = useCountdown(pix?.expires_at);

  // Load reseller
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
      else setLink(data as ResellerLink);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Polling status
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
        body: JSON.stringify({ slug: link.slug, whatsapp, email }),
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

  const headerCredits = useMemo(() => link?.credits ?? 0, [link]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !link) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="card-elevated p-8 max-w-sm text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Revendedor não encontrado</h1>
          <p className="text-sm text-muted-foreground">
            O link <code className="font-mono">{slug}</code> não está ativo ou não existe.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
            <Zap className="h-3.5 w-3.5" /> Recarga de Créditos
          </div>
          <h1 className="text-2xl font-bold text-foreground">{link.display_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Painel: <span className="font-mono">{link.warez_username}</span>
          </p>
        </div>

        {!pix && (
          <div className="card-elevated p-6 space-y-5">
            <div className="text-center py-4 border border-border rounded-xl bg-card">
              <div className="text-5xl font-bold text-primary">{headerCredits}</div>
              <div className="text-sm text-muted-foreground mt-1">créditos por recarga</div>
              <div className="text-2xl font-semibold text-foreground mt-3">
                {formatBRL(Number(link.amount))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">WhatsApp (opcional)</label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">E-mail (opcional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <button
              onClick={generatePix}
              disabled={generating}
              className="w-full py-3.5 btn-primary-gradient font-semibold text-sm disabled:opacity-60"
            >
              {generating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Gerando PIX...
                </span>
              ) : (
                "Gerar PIX"
              )}
            </button>
          </div>
        )}

        {pix && !isRecharged && !isExpired && (
          <div className="card-elevated p-6 space-y-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Valor</div>
              <div className="text-2xl font-bold text-foreground">{formatBRL(Number(pix.amount))}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {pix.package_credits} créditos para {pix.warez_username}
              </div>
            </div>

            {pix.qr_code_url && (
              <div className="flex justify-center bg-white p-4 rounded-xl">
                <img src={pix.qr_code_url} alt="QR Code PIX" className="w-56 h-56" />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground">Código copia-e-cola</label>
              <div className="mt-1 flex gap-2">
                <input
                  readOnly
                  value={pix.qr_code_text || ""}
                  className="flex-1 px-3 py-2 rounded-lg border border-input bg-muted text-foreground text-xs font-mono truncate"
                />
                <button
                  onClick={copyCode}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Expira em</span>
              <span className="font-mono font-semibold text-foreground">{countdown ?? "--:--"}</span>
            </div>

            {underReview && (
              <div className="text-xs text-center text-amber-500 bg-amber-500/10 rounded-lg py-2 px-3">
                Pagamento em análise pela Fast Depix...
              </div>
            )}
            {status?.status === "paid" && !isRecharged && !isFailed && (
              <div className="text-xs text-center text-primary bg-primary/10 rounded-lg py-2 px-3 inline-flex items-center justify-center gap-2 w-full">
                <Loader2 className="h-3 w-3 animate-spin" /> Pagamento confirmado, processando recarga...
              </div>
            )}
            {isFailed && (
              <div className="space-y-2">
                <div className="text-xs text-destructive bg-destructive/10 rounded-lg py-2 px-3">
                  Erro na recarga: {status?.error_message || "desconhecido"}
                </div>
                <button onClick={retryRecharge} className="w-full py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 inline-flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4" /> Tentar novamente
                </button>
              </div>
            )}
            {!status && (
              <p className="text-xs text-center text-muted-foreground">
                Aguardando pagamento... abra o app do banco e pague via PIX.
              </p>
            )}
          </div>
        )}

        {isRecharged && (
          <div className="card-elevated p-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Créditos adicionados!</h2>
            <p className="text-sm text-muted-foreground">
              +{pix?.package_credits} créditos no painel{" "}
              <span className="font-mono text-foreground">{pix?.warez_username}</span>.
            </p>
            <button onClick={reset} className="w-full py-3 btn-primary-gradient font-semibold text-sm">
              Recarregar novamente
            </button>
          </div>
        )}

        {isExpired && (
          <div className="card-elevated p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="text-lg font-bold text-foreground">PIX expirado</h2>
            <button onClick={reset} className="w-full py-3 btn-primary-gradient font-semibold text-sm">
              Gerar novo PIX
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
