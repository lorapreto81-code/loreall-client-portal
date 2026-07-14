import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Zap, X, Loader2, CheckCircle2, Power, Clock } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const COOLDOWN_MS = 30 * 60 * 1000; // 30 min

interface Props {
  customerId: number;
}

function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m <= 0) return `${s}s`;
  return `${m}min`;
}

export default function OptimizeAccessCard({ customerId }: Props) {
  const storageKey = `loreall_optimize_last_${customerId}`;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [remaining, setRemaining] = useState(0);

  // Atualiza timer do cooldown
  useEffect(() => {
    const tick = () => {
      const last = Number(localStorage.getItem(storageKey) || 0);
      const diff = last + COOLDOWN_MS - Date.now();
      setRemaining(diff > 0 ? diff : 0);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [storageKey]);

  const inCooldown = remaining > 0;

  const handleOptimize = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/topgestor-proxy?action=optimize-access&id=${customerId}`,
        {
          method: "POST",
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || data?.message || `Erro ${res.status}`);

      localStorage.setItem(storageKey, String(Date.now()));
      setConfirmOpen(false);
      setSuccessOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível otimizar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* CARD */}
      <button
        onClick={() => !inCooldown && setConfirmOpen(true)}
        disabled={inCooldown}
        className="w-full text-left rounded-2xl p-4 relative overflow-hidden border-2 transition-all active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
        style={{
          borderColor: "hsl(var(--accent) / 0.4)",
          background:
            "linear-gradient(135deg, hsl(var(--accent) / 0.14), hsl(var(--primary) / 0.06))",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="rounded-full p-2.5 shrink-0"
            style={{ background: "hsl(var(--accent) / 0.22)" }}
          >
            <Zap className="h-5 w-5" style={{ color: "hsl(var(--accent))" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-bold text-foreground">Seu acesso está lento?</p>
              <span
                className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-[1px] rounded-full text-white"
                style={{ background: "hsl(var(--accent))" }}
              >
                Novo
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground leading-snug">
              {inCooldown
                ? `Aguarde ${formatRemaining(remaining)} para otimizar novamente`
                : "Otimize a velocidade e atualize sua conexão em 1 clique"}
            </p>
          </div>
          {inCooldown ? (
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <span
              className="text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap text-white"
              style={{ background: "hsl(var(--accent))" }}
            >
              Otimizar
            </span>
          )}
        </div>
      </button>

      {/* MODAL CONFIRMAÇÃO */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !loading && setConfirmOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-card sm:rounded-2xl rounded-t-2xl animate-in slide-in-from-bottom duration-300"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-accent" />
                Otimizar velocidade
              </h2>
              <button
                onClick={() => !loading && setConfirmOpen(false)}
                disabled={loading}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-50"
                style={{ minHeight: 36, minWidth: 36 }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-foreground leading-relaxed">
                Vamos <b>atualizar sua conexão</b> para melhorar a velocidade e resolver
                travamentos. Seus dados de acesso (usuário e senha) continuam os mesmos.
              </p>
              <div
                className="rounded-xl p-3.5 border flex gap-3"
                style={{
                  borderColor: "hsl(var(--warning) / 0.4)",
                  background: "hsl(var(--warning) / 0.08)",
                }}
              >
                <Power className="h-5 w-5 shrink-0" style={{ color: "hsl(var(--warning))" }} />
                <div className="text-[13px] text-foreground leading-snug">
                  <b>Importante:</b> após confirmar, retire seu aparelho da tomada por{" "}
                  <b>2 minutos</b> e ligue novamente. Depois abra o app normalmente.
                </div>
              </div>
              <button
                onClick={handleOptimize}
                disabled={loading}
                className="btn-primary-gradient w-full py-3.5 font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ minHeight: 48 }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Otimizando...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Otimizar agora
                  </>
                )}
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
                className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SUCESSO */}
      {successOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSuccessOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-card sm:rounded-2xl rounded-t-2xl animate-in slide-in-from-bottom duration-300"
          >
            <div className="p-6 text-center">
              <div
                className="mx-auto mb-4 rounded-full w-16 h-16 flex items-center justify-center"
                style={{ background: "hsl(142 71% 45% / 0.15)" }}
              >
                <CheckCircle2 className="h-8 w-8" style={{ color: "hsl(142 71% 45%)" }} />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                Acesso otimizado com sucesso!
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                Agora <b>retire seu aparelho da tomada por 2 minutos</b> e ligue novamente.
                Ao abrir o app, seu acesso estará mais rápido e estável.
              </p>
              <div
                className="rounded-xl p-3 mb-5 flex items-center gap-3 text-left"
                style={{ background: "hsl(var(--muted) / 0.6)" }}
              >
                <Power className="h-5 w-5 text-primary shrink-0" />
                <div className="text-[12px] text-foreground">
                  Aparelho na tomada → <b>Retire</b> → aguarde 2 min → <b>Ligue</b> → abra o app
                </div>
              </div>
              <button
                onClick={() => setSuccessOpen(false)}
                className="btn-primary-gradient w-full py-3.5 font-semibold text-sm"
                style={{ minHeight: 48 }}
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
