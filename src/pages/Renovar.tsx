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
      <img src={logo} alt="Loreall Play" className="h-8 md:h-11 w-auto object-contain mb-6 md:mb-10" />

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
        const maskedWhats = customer.whatsapp ? `•••• ${String(customer.whatsapp).replace(/\D/g, "").slice(-4)}` : null;
        const payBtn = (
          <button
            onClick={() => setOpen(true)}
            className="w-full min-h-[56px] py-4 btn-primary-gradient font-bold text-base rounded-xl inline-flex items-center justify-center gap-2 shadow-lg shadow-primary/25 transition-transform duration-200 active:scale-[0.99]"
          >
            <QrCode className="h-5 w-5" />
            {planValue > 0 ? `Pagar ${formatCurrency(planValue)} com PIX` : "Escolher plano e pagar com PIX"}
          </button>
        );
        const trust = (
          <div className="space-y-1.5 text-[11px] text-muted-foreground text-center">
            <p className="flex items-center justify-center gap-1.5"><Lock className="h-3 w-3" /> Pagamento processado com segurança</p>
            <p className="flex items-center justify-center gap-3">
              <span className="inline-flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Confirmação automática</span>
              <span className="inline-flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Ativação após o pagamento</span>
            </p>
          </div>
        );
        return (
          <div className="w-full max-w-[1100px] grid gap-5 lg:gap-6 lg:grid-cols-[1.2fr_0.8fr] items-start animate-in fade-in duration-200">
            <section className="space-y-4 min-w-0">
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-foreground leading-tight">Olá, {customer.name.split(" ")[0]} 👋</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {expired ? "Seu acesso está vencido. Renove agora e volte a assistir na hora." : "Renove seu acesso em menos de 1 minuto."}
                </p>
              </div>

              {/* Resumo do pedido */}
              <div className="card-elevated p-5 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Resumo do pedido</p>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${expired ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
                    {expired ? "Vencido" : "Ativo"}
                  </span>
                </div>
                <p className="text-xl font-black text-foreground">{getDisplayPlanLabel(customer.plan?.name)}</p>
                <p className="text-sm text-muted-foreground">{telas} {telas === 1 ? "Tela" : "Telas"} • {expired ? "Venceu em" : "Vence em"} {formatDate(customer.data_de_vencimento)}</p>
                {planValue > 0 && <p className="text-3xl font-black text-foreground mt-4">{formatCurrency(planValue)}</p>}
                <p className="text-[11px] text-muted-foreground mt-1">Períodos mais longos têm desconto — escolha na próxima etapa.</p>
              </div>

              {/* Cliente */}
              <div className="card-elevated p-5 md:p-6 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cliente</p>
                <Row icon={User} label="Nome" value={customer.name} />
                <Row icon={Tv} label="Usuário" value={customer.usuario || "—"} />
                {maskedWhats && <Row icon={Phone} label="WhatsApp" value={maskedWhats} />}
              </div>

              {/* Pagamento */}
              <div className="card-elevated p-5 md:p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Pagamento</p>
                <div className="flex items-center gap-3 rounded-xl border-2 border-accent bg-accent/5 p-4">
                  <span className="h-10 w-10 shrink-0 rounded-lg bg-accent/15 flex items-center justify-center"><QrCode className="h-5 w-5 text-accent" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground">PIX</p>
                    <p className="text-xs text-muted-foreground">Pagamento instantâneo • Aprovação automática</p>
                  </div>
                  <span className="h-5 w-5 rounded-full bg-accent flex items-center justify-center"><Check className="h-3 w-3 text-accent-foreground" /></span>
                </div>
              </div>

              {/* Mobile CTA */}
              <div className="lg:hidden space-y-3">{payBtn}{trust}</div>
            </section>

            {/* Desktop: resumo compacto + CTA */}
            <aside className="hidden lg:block card-elevated p-6 space-y-5 sticky top-8 border border-primary/20">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</p>
              <div>
                <p className="text-sm text-muted-foreground">{getDisplayPlanLabel(customer.plan?.name)} • {telas} {telas === 1 ? "Tela" : "Telas"}</p>
                {planValue > 0 && <p className="text-4xl font-black text-foreground mt-1">{formatCurrency(planValue)}</p>}
              </div>
              {payBtn}
              {trust}
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground border-t border-border pt-4">
                <ShieldCheck className="h-3 w-3" /> Link pessoal — não compartilhe
              </p>
            </aside>
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
