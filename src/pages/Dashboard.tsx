import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar, CreditCard, Monitor, LogOut, Copy, Share2,
  Loader2, AlertTriangle, ExternalLink, FileText
} from "lucide-react";
import { useAuthStore, Customer } from "@/store/authStore";
import { getCustomerInvoices, generatePaymentLink } from "@/lib/api";
import { formatCurrency, formatDate, daysUntil } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import logo from "@/assets/loreall-logo.png";

const RENEWAL_PERIODS = [
  { months: 1, label: "1 mês" },
  { months: 3, label: "3 meses" },
  { months: 6, label: "6 meses" },
  { months: 12, label: "12 meses" },
];

const Dashboard = () => {
  const { customer, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !customer) navigate("/login", { replace: true });
  }, [isAuthenticated, customer, navigate]);

  useEffect(() => {
    const handler = () => { logout(); navigate("/login"); };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, [logout, navigate]);

  const invoicesQuery = useQuery({
    queryKey: ["invoices", customer?.id],
    queryFn: () => getCustomerInvoices(customer!.id),
    enabled: !!customer?.id,
    staleTime: 60_000,
  });

  if (!customer) return null;

  const days = daysUntil(customer.data_de_vencimento);
  const planValue = typeof customer.plan?.value === "string" ? parseFloat(customer.plan.value) : (customer.plan?.value || 0);
  const renewalTotal = planValue * selectedPeriod;
  const status = days < 0 ? "vencido" : (customer.status?.toLowerCase() || "ativo");

  const referralLink = `https://seusite.com/ref/${customer.usuario}`;

  const handleGeneratePayment = async () => {
    setGeneratingLink(true);
    try {
      const data = await generatePaymentLink(customer.id);
      const url = data.checkout_url || data.data?.checkout_url;
      if (url) {
        setPaymentUrl(url);
        toast.success("Link de pagamento gerado!");
      } else {
        toast.error("Não foi possível gerar o link de pagamento.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar fatura.");
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copiado!");
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(`🎬 Conheça a Loreall Play TV! Acesse pelo meu link: ${referralLink}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const invoices = invoicesQuery.data?.data || invoicesQuery.data || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container flex items-center justify-between py-3">
          <img src={logo} alt="Loreall Play TV" className="h-10" />
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Profile Header */}
        <div className="card-elevated p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{customer.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">@{customer.usuario} · {customer.product?.name || "—"}</p>
            </div>
            <StatusBadge status={status} />
          </div>

          {/* Expiry alerts */}
          {days < 0 && (
            <div className="mt-4 flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg p-3 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Seu acesso está vencido há {Math.abs(days)} dia(s). Renove agora!
            </div>
          )}
          {days >= 0 && days < 7 && (
            <div className="mt-4 flex items-center gap-2 bg-warning/10 text-warning rounded-lg p-3 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Seu acesso vence em {days} dia(s). Renove para não perder o acesso!
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard icon={<Calendar className="h-5 w-5 text-primary" />} label="Vencimento" value={formatDate(customer.data_de_vencimento)} sub={days >= 0 ? `${days} dia(s) restante(s)` : `Vencido há ${Math.abs(days)} dia(s)`} />
          <SummaryCard icon={<CreditCard className="h-5 w-5 text-secondary" />} label="Plano" value={customer.plan?.name || "—"} sub={`${formatCurrency(planValue)}/mês`} />
          <SummaryCard icon={<Monitor className="h-5 w-5 text-accent" />} label="Telas" value={String(customer.telas || "—")} sub="simultâneas" />
        </div>

        {/* Renewal Section */}
        <div className="card-elevated p-6">
          <h2 className="text-lg font-bold text-foreground mb-4">Renovar acesso</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {RENEWAL_PERIODS.map((p) => (
              <button
                key={p.months}
                onClick={() => { setSelectedPeriod(p.months); setPaymentUrl(null); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedPeriod === p.months
                    ? "btn-primary-gradient"
                    : "border border-secondary text-secondary hover:bg-secondary/5"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Total: <span className="font-bold text-foreground">{formatCurrency(renewalTotal)}</span>
          </p>
          <button onClick={handleGeneratePayment} disabled={generatingLink} className="btn-primary-gradient px-6 py-3 font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-60">
            {generatingLink && <Loader2 className="h-4 w-4 animate-spin-slow" />}
            Gerar fatura de renovação
          </button>
          {paymentUrl && (
            <div className="mt-4 p-4 bg-success/5 rounded-lg border border-success/20">
              <p className="text-sm font-medium text-success mb-2">Link de pagamento gerado!</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <a href={paymentUrl} target="_blank" rel="noopener noreferrer" className="btn-primary-gradient px-4 py-2 text-sm inline-flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" /> Pagar agora
                </a>
                <button onClick={() => copyToClipboard(paymentUrl)} className="px-4 py-2 text-sm border border-secondary text-secondary rounded-lg hover:bg-secondary/5 inline-flex items-center gap-1.5">
                  <Copy className="h-3.5 w-3.5" /> Copiar link
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Referral Section */}
        <div className="card-elevated p-6">
          <h2 className="text-lg font-bold text-foreground mb-2">Indique e ganhe</h2>
          <p className="text-sm text-muted-foreground mb-4">Indique amigos e ganhe dias grátis! 🎉</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={() => copyToClipboard(referralLink)} className="btn-primary-gradient px-4 py-2.5 text-sm inline-flex items-center gap-1.5">
              <Copy className="h-3.5 w-3.5" /> Copiar link de indicação
            </button>
            <button onClick={shareWhatsApp} className="px-4 py-2.5 text-sm border border-success text-success rounded-lg hover:bg-success/5 inline-flex items-center gap-1.5">
              <Share2 className="h-3.5 w-3.5" /> Compartilhar no WhatsApp
            </button>
          </div>
        </div>

        {/* Invoices Section */}
        <div className="card-elevated p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Faturas</h2>
            <button onClick={handleGeneratePayment} disabled={generatingLink} className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1 disabled:opacity-60">
              {generatingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin-slow" /> : <FileText className="h-3.5 w-3.5" />}
              Gerar nova fatura
            </button>
          </div>

          {invoicesQuery.isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : invoicesQuery.isError ? (
            <p className="text-sm text-destructive">Erro ao carregar faturas.</p>
          ) : (Array.isArray(invoices) && invoices.length > 0) ? (
            <div className="space-y-3">
              {invoices.map((inv: any) => (
                <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{formatDate(inv.issuance_date || inv.created_at)}</p>
                    <p className="text-sm text-muted-foreground">{formatCurrency(inv.total_amount || inv.amount || 0)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={inv.status || "pendente"} />
                    {(inv.status?.toLowerCase() === "pendente" || inv.status?.toLowerCase() === "pending" || inv.status?.toLowerCase() === "em aberto") && inv.checkout_url && (
                      <a href={inv.checkout_url} target="_blank" rel="noopener noreferrer" className="btn-primary-gradient px-3 py-1.5 text-xs inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> Pagar
                      </a>
                    )}
                    {(inv.status?.toLowerCase() === "pago" || inv.status?.toLowerCase() === "paid") && inv.checkout_url && (
                      <a href={inv.checkout_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Ver fatura
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma fatura encontrada.</p>
          )}
        </div>
      </main>
    </div>
  );
};

const SummaryCard = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) => (
  <div className="card-elevated p-5">
    <div className="flex items-center gap-3 mb-2">
      {icon}
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
    <p className="text-xl font-bold text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
  </div>
);

export default Dashboard;
