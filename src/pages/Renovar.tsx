import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle, Lock, QrCode, Check, ShieldCheck, Zap, Tv, CalendarDays, User, MonitorSmartphone, MessageCircle, BadgeCheck } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import RenewalBottomSheet from "@/components/RenewalBottomSheet";
import { useAuthStore, Customer } from "@/store/authStore";
import { getDisplayPlanLabel } from "@/lib/planUtils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPPORT_WHATSAPP = "5583998551952";

function parseDate(raw?: string) {
  if (!raw) return null;
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
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
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Link inválido.");
        setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [token, login]);

  const supportUrl = (msg: string) => `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 pt-6 pb-10 md:pt-12 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.14),transparent_60%)]">
      <header className="w-full max-w-[460px] flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <img src="/brand-logo.png" alt="Loreall Play" className="h-9 w-9 object-contain" />
          <div className="leading-tight">
            <p className="text-sm font-black text-foreground">Loreall Play</p>
            <p className="text-[10px] text-muted-foreground">Canais, filmes e séries</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
          <Lock className="h-3 w-3" /> Conexão segura
        </span>
      </header>

      {state === "loading" && (
        <div className="flex flex-col items-center gap-3 text-muted-foreground mt-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Carregando seus dados…</p>
        </div>
      )}

      {state === "error" && (
        <div className="card-elevated p-8 max-w-sm w-full text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-lg font-bold text-foreground">Link indisponível</h1>
          <p className="text-sm text-muted-foreground">{error} Fale com o suporte para receber um novo link.</p>
          <a href={supportUrl("Olá! Meu link de renovação da Loreall Play não abriu. Pode me enviar um novo?")} target="_blank" rel="noopener noreferrer"
            className="btn-primary-gradient w-full h-12 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-2">
            <MessageCircle className="h-4 w-4" /> Falar com o suporte
          </a>
        </div>
      )}

      {state === "ready" && customer && (() => {
        const planValue = Number(customer.plan?.value) || 0;
        const telasFromName = String(customer.plan?.name ?? "").match(/(\d+)\s*telas?/i);
        const telas = (telasFromName ? Number(telasFromName[1]) : 0) || Number(customer.telas) || 1;
        const last4 = customer.whatsapp ? String(customer.whatsapp).replace(/\D/g, "").slice(-4) : "";
        const firstName = customer.name.split(" ")[0];
        const due = parseDate(customer.data_de_vencimento);
        const days = due ? Math.ceil((due.getTime() - Date.now()) / 86400000) : null;
        const expired = days !== null && days < 0;
        const status =
          days === null ? null
          : expired ? { label: `Venceu há ${Math.abs(days)} ${Math.abs(days) === 1 ? "dia" : "dias"}`, cls: "bg-destructive/15 text-destructive" }
          : days === 0 ? { label: "Vence hoje", cls: "bg-destructive/15 text-destructive" }
          : days <= 3 ? { label: `Vence em ${days} ${days === 1 ? "dia" : "dias"}`, cls: "bg-amber-500/15 text-amber-500" }
          : { label: `Ativo · ${days} dias restantes`, cls: "bg-emerald-500/15 text-emerald-500" };
        return (
          <main className="relative w-full max-w-[460px] space-y-4 animate-in fade-in duration-200">
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-black text-foreground leading-tight">Olá, {firstName} 👋</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {expired ? "Seu acesso venceu. Renove agora e volte a assistir na hora." : "Confira seus dados e renove em menos de 1 minuto."}
              </p>
            </div>

            <section className="relative card-elevated overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-accent via-primary to-secondary" />
              <div className="p-5 pb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-primary">Seu plano</p>
                  <p className="text-xl font-black text-foreground break-words leading-tight mt-0.5">{getDisplayPlanLabel(customer.plan?.name)}</p>
                  {status && (
                    <span className={`inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold px-2.5 py-1 rounded-full ${status.cls}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" /> {status.label}
                    </span>
                  )}
                </div>
                {planValue > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-[28px] sm:text-3xl font-black tabular-nums leading-none bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{formatCurrency(planValue)}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">por mês</p>
                  </div>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-px bg-border border-t border-border text-sm">
                <Info icon={User} label="Titular" value={customer.name.split(" ").slice(0, 2).join(" ")} />
                <Info icon={Tv} label="Usuário" value={customer.usuario || "—"} />
                <Info icon={MonitorSmartphone} label="Telas" value={`${telas} ${telas === 1 ? "tela" : "telas"}`} />
                <Info icon={CalendarDays} label={expired ? "Venceu em" : "Vencimento"} value={due ? due.toLocaleDateString("pt-BR") : "—"} />
              </dl>
              {last4 && (
                <p className="px-5 py-2.5 text-[11px] text-muted-foreground border-t border-border flex items-center gap-1.5 bg-muted/30">
                  <BadgeCheck className="h-3.5 w-3.5 text-primary" /> Cadastro confirmado · WhatsApp final •••• {last4}
                </p>
              )}
            </section>

            <section className="card-elevated p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-3 rounded-xl border-2 border-accent bg-accent/5 px-4 py-3.5 ring-4 ring-accent/10">
                <span className="h-10 w-10 shrink-0 rounded-lg bg-accent/15 flex items-center justify-center"><QrCode className="h-5 w-5 text-accent" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-foreground text-sm">PIX</p>
                  <p className="text-[11px] text-muted-foreground">Pagamento instantâneo • Liberação automática</p>
                </div>
                <span className="h-6 w-6 shrink-0 rounded-full bg-accent flex items-center justify-center"><Check className="h-3.5 w-3.5 text-accent-foreground" /></span>
              </div>

              <button
                onClick={() => setOpen(true)}
                className="w-full min-h-[58px] py-4 px-4 rounded-2xl font-bold text-base text-primary-foreground bg-gradient-to-r from-primary to-secondary inline-flex items-center justify-center gap-2 shadow-[0_10px_24px_-10px_hsl(var(--primary)/0.6)] ring-1 ring-inset ring-primary-foreground/15 transition-all duration-200 hover:brightness-110 hover:shadow-[0_14px_30px_-10px_hsl(var(--secondary)/0.6)] active:scale-[0.99]"
              >
                <QrCode className="h-5 w-5" />
                {planValue > 0 ? `Renovar por ${formatCurrency(planValue)} via PIX` : "Escolher plano e pagar via PIX"}
              </button>
              <p className="text-[10px] text-muted-foreground/80 text-center">Na próxima etapa: planos de 3, 6 e 12 meses com desconto e campo para cupom.</p>
            </section>

            <section className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-[10px] text-muted-foreground">
              <Trust icon={ShieldCheck} title="Pagamento seguro" />
              <Trust icon={Zap} title="Liberação automática" />
              <Trust icon={Lock} title="Dados protegidos" />
            </section>

            <div className="border-t border-border pt-3 space-y-1">
              <a href={supportUrl(`Olá! Sou ${customer.name}${customer.usuario ? ` (usuário ${customer.usuario})` : ""} e preciso de ajuda com a renovação da Loreall Play.`)}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground py-1">
                <MessageCircle className="h-3.5 w-3.5 text-emerald-500" /> Dúvidas? Suporte no WhatsApp <span className="font-semibold">(83) 99855-1952</span>
              </a>
              <p className="text-center text-[10px] text-muted-foreground/50">Loreall Play · Link pessoal de renovação — não compartilhe.</p>
            </div>
          </main>
        );
      })()}

      {state === "ready" && <RenewalBottomSheet open={open} onClose={() => setOpen(false)} />}
    </div>
  );
};

const Info = ({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) => (
  <div className="bg-card px-4 py-3 min-w-0">
    <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-muted-foreground"><Icon className="h-3 w-3" /> {label}</dt>
    <dd className="font-semibold text-foreground truncate mt-0.5">{value}</dd>
  </div>
);

const Trust = ({ icon: Icon, title, text }: { icon: typeof User; title: string; text: string }) => (
  <div className="card-elevated px-2 py-3 flex flex-col items-center justify-start min-w-0">
    <Icon className="h-4 w-4 text-primary" />
    <p className="text-[11px] font-bold text-foreground mt-1.5 leading-snug break-words">{title}</p>
    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 break-words">{text}</p>
  </div>
);

export default Renovar;
