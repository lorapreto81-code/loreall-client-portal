import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, ShieldCheck, CalendarClock, Tv, User, AlertCircle, Zap, Lock, BadgePercent } from "lucide-react";
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
      <img src={logo} alt="Loreall Play" className="h-10 md:h-12 mb-8 md:mb-12" />

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

      {state === "ready" && customer && (
        <div className="w-full max-w-5xl grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Coluna esquerda: saudação + dados */}
          <section className="space-y-5">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="h-3.5 w-3.5" /> Link exclusivo de renovação
              </span>
              <h1 className="text-3xl md:text-4xl font-black text-foreground leading-tight">
                Olá, {customer.name.split(" ")[0]}! <br className="hidden md:block" />
                <span className="text-primary">Renove em menos de 1 minuto.</span>
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                {expired
                  ? "Seu acesso está vencido. Renove agora e volte a assistir na hora."
                  : "Garanta seu acesso sem interrupções — pague via Pix e a liberação é automática."}
              </p>
            </div>

            <div className="card-elevated p-5 md:p-6 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sua assinatura</p>
              <Row icon={User} label="Usuário" value={customer.usuario || "—"} />
              <Row icon={Tv} label="Plano atual" value={getDisplayPlanLabel(customer.plan?.name) || customer.plan?.name || "—"} />
              <Row icon={CalendarClock} label={expired ? "Venceu em" : "Vence em"} value={formatDate(customer.data_de_vencimento)} highlight={expired} />
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Status</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${expired ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-500"}`}>
                  {expired ? "Vencido" : "Ativo"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Zap, t: "Liberação", d: "automática" },
                { icon: Lock, t: "Pagamento", d: "100% seguro" },
                { icon: BadgePercent, t: "Descontos", d: "em planos longos" },
              ].map(({ icon: I, t, d }) => (
                <div key={t} className="card-elevated p-3 text-center">
                  <I className="h-5 w-5 text-primary mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-foreground">{t}</p>
                  <p className="text-[11px] text-muted-foreground">{d}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Coluna direita: como funciona + CTA */}
          <aside className="card-elevated p-5 md:p-7 space-y-5 lg:sticky lg:top-8 border border-primary/20">
            <div>
              <p className="text-lg font-black text-foreground">Como funciona</p>
              <p className="text-xs text-muted-foreground">3 passos rápidos</p>
            </div>
            <ol className="space-y-4">
              {[
                ["Escolha o período", "Mensal, trimestral, semestral ou anual — quanto mais longo, maior o desconto."],
                ["Pague com Pix", "Copie o código ou escaneie o QR Code no app do seu banco."],
                ["Pronto!", "Seu acesso é renovado automaticamente e você recebe a confirmação no WhatsApp."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center">{i + 1}</span>
                  <div>
                    <p className="text-sm font-bold text-foreground">{t}</p>
                    <p className="text-xs text-muted-foreground">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <button
              onClick={() => setOpen(true)}
              className="w-full py-4 btn-primary-gradient font-bold text-base rounded-xl inline-flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:scale-[1.01] active:scale-[0.99] transition-transform"
            >
              <Zap className="h-5 w-5" /> Ver planos e pagar
            </button>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3" /> Link pessoal — não compartilhe
            </p>
          </aside>
        </div>
      )}

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
