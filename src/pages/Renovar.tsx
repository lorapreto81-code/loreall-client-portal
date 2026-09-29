import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, ShieldCheck, CalendarClock, Tv, User, AlertCircle, Zap } from "lucide-react";
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
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-10">
      <img src={logo} alt="Loreall Play" className="h-10 mb-8" />

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
        <div className="w-full max-w-md space-y-5">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-black text-foreground">Olá, {customer.name.split(" ")[0]}!</h1>
            <p className="text-sm text-muted-foreground">Renove seu acesso em poucos segundos via Pix.</p>
          </div>

          <div className="card-elevated p-5 space-y-3">
            <Row icon={User} label="Usuário" value={customer.usuario || "—"} />
            <Row icon={Tv} label="Plano atual" value={getDisplayPlanLabel(customer.plan?.name) || customer.plan?.name || "—"} />
            <Row
              icon={CalendarClock}
              label={expired ? "Venceu em" : "Vence em"}
              value={formatDate(customer.data_de_vencimento)}
              highlight={expired}
            />
          </div>

          <button
            onClick={() => setOpen(true)}
            className="w-full py-4 btn-primary-gradient font-bold text-sm rounded-xl inline-flex items-center justify-center gap-2"
          >
            <Zap className="h-4 w-4" /> Escolher plano e pagar
          </button>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Liberação automática após a confirmação do Pix
          </p>
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
