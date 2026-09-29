import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, ShieldCheck, Tv, User, AlertCircle, Lock, QrCode, Check, Phone } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import RenewalBottomSheet from "@/components/RenewalBottomSheet";
import { useAuthStore, Customer } from "@/store/authStore";
import { getDisplayPlanLabel } from "@/lib/planUtils";
import logo from "@/assets/loreall-play-logo.png";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function formatDate(raw?: string) {
  if (!raw) return "—";
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString("pt-BR");
}

const Renovar = () => {
  const { token } = useParams<{ token: string }>();
  const login = useAuthStore((s) => s.login);
  const customer = useAuthStore((s) => s.customer);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.title = "Renovar acesso | Loreall Play";
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/checkout-link?action=resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
          body: JSON.stringify({ token }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Link inválido.");
        if (cancelled) return;
        login(data.customer as Customer, data.token, "checkout");
        setState("ready");
        setOpen(true);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Link inválido.");
        setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [token, login]);

  const expired = customer?.data_de_vencimento ? new Date(customer.data_de_vencimento.replace(" ", "T")) < new Date() : false;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8 md:py-14 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.12),transparent_60%)]">
      <img src={logo} alt="Loreall Play" className="h-10 md:h-14 w-auto object-contain mb-6 md:mb-8" />

      {state === "loading" && (
        <div className="flex flex-col items-center gap-3 text-muted-foreground mt-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Carregando seus dados…</p>
        </div>
      )}

      {state === "error" && (
        <div className="card-elevated p-8 max-w-sm w-full text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-lg font-bold text-foreground">Link indisponível</h1>
          <p className="text-sm text-muted-foreground">{error} Fale com o suporte para receber um novo link.</p>
        </div>
      )}

      {state === "ready" && customer && (() => {
        const planValue = Number(customer.plan?.value) || 0;
        const telas = Number(customer.telas) || 1;
        const last4 = customer.whatsapp ? String(customer.whatsapp).replace(/\D/g, "").slice(-4) : "";
        const firstName = customer.name.split(" ")[0];
        return (
          <div className="w-full max-w-[440px] space-y-4 animate-in fade-in duration-200">
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-black text-foreground leading-tight">Olá, {firstName} 👋</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {expired ? "Seu acesso venceu. Renove e volte a assistir na hora." : "Renove seu acesso em menos de 1 minuto."}
              </p>
              <p className="text-xs text-muted-foreground/80 mt-2">
                {customer.usuario || firstName}{last4 && ` · WhatsApp •••• ${last4}`}
              </p>
            </div>

            <div className="card-elevated p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Seu plano</p>
                  <p className="text-lg font-bold text-foreground break-words">{getDisplayPlanLabel(customer.plan?.name)}</p>
                  <p className="text-xs text-muted-foreground">
                    {telas} {telas === 1 ? "Tela" : "Telas"} · {expired ? "Venceu em" : "Vence em"} {formatDate(customer.data_de_vencimento)}
                  </p>
                </div>
                {planValue > 0 && <p className="text-3xl font-black text-foreground tabular-nums shrink-0">{formatCurrency(planValue)}</p>}
              </div>

              <div className="flex items-center gap-3 rounded-xl border-2 border-accent bg-accent/5 p-3">
                <span className="h-9 w-9 shrink-0 rounded-lg bg-accent/15 flex items-center justify-center"><QrCode className="h-5 w-5 text-accent" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-foreground text-sm">PIX</p>
                  <p className="text-[11px] text-muted-foreground">Pagamento instantâneo • Aprovação automática</p>
                </div>
                <span className="h-5 w-5 shrink-0 rounded-full bg-accent flex items-center justify-center"><Check className="h-3 w-3 text-accent-foreground" /></span>
              </div>

              <button
                onClick={() => setOpen(true)}
                className="w-full min-h-[56px] py-4 btn-primary-gradient font-bold text-base rounded-xl inline-flex items-center justify-center gap-2 shadow-lg shadow-primary/25 transition-transform duration-200 active:scale-[0.99]"
              >
                <QrCode className="h-5 w-5" />
                {planValue > 0 ? `Pagar ${formatCurrency(planValue)} via PIX` : "Escolher plano e pagar via PIX"}
              </button>
              <p className="text-[11px] text-muted-foreground text-center">Períodos mais longos têm desconto na próxima etapa.</p>
            </div>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3" /> Pagamento seguro · Link pessoal, não compartilhe
            </p>
          </div>
        );
      })()}

      {state === "ready" && <RenewalBottomSheet open={open} onClose={() => setOpen(false)} />}
    </div>
  );
};

const Row = ({ icon: Icon, label, value, highlight }: { icon: typeof User; label: string; value: string; highlight?: boolean }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" /> {label}</span>
    <span className={`text-sm font-semibold ${highlight ? "text-destructive" : "text-foreground"}`}>{value}</span>
  </div>
);

export default Renovar;
