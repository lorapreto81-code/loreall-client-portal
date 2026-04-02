import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar, CreditCard, Monitor, LogOut, Copy, Check, Share2,
  Loader2, AlertTriangle, ExternalLink, FileText, X
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { getCustomerInvoices, generatePaymentLink } from "@/lib/api";
import { formatCurrency, formatDate, daysUntil } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import MyPlanSection from "@/components/MyPlanSection";
import RenewalSection from "@/components/RenewalSection";
import logo from "@/assets/loreall-logo.png";

const Dashboard = () => {
  const { customer, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [paymentModal, setPaymentModal] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !customer) navigate("/login", { replace: true });
  }, [isAuthenticated, customer, navigate]);

  useEffect(() => {
    const handler = () => {
      toast.error("Sessão expirada. Faça login novamente.");
      logout();
      navigate("/login");
    };
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

  const referralLink = `https://loreallplay.com.br/ref/${customer.usuario}`;

  const handleGeneratePayment = async () => {
    setGeneratingLink(true);
    try {
      const data = await generatePaymentLink(customer.id);
      const url = data.checkout_url || data.data?.checkout_url;
      if (url) {
        setPaymentModal(url);
        toast.success("Fatura gerada com sucesso!");
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

  const handleCopyRef = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedRef(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(
      `Assista TV com qualidade usando a Loreall Play TV! Acesse pelo meu link: ${referralLink}`
    );
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
          <img src={logo} alt="Loreall Play TV" style={{ width: 80, height: "auto" }} />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-foreground">{customer.name}</p>
              <StatusBadge status={status} />
            </div>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6 max-w-4xl mx-auto">
        {/* Mobile profile */}
        <div className="sm:hidden card-elevated p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-foreground">{customer.name}</p>
            <p className="text-xs text-muted-foreground">@{customer.usuario}</p>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Expiry alerts */}
        {days < 0 && (
          <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-xl p-4 text-sm font-medium">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Seu acesso está vencido. Renove para continuar assistindo.
          </div>
        )}
        {days >= 0 && days < 7 && (
          <div className="flex items-center gap-2 bg-warning/10 text-warning rounded-xl p-4 text-sm font-medium">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Seu acesso vence em {days} dia(s). Renove agora!
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            icon={<Calendar className="h-5 w-5 text-primary" />}
            label="Vencimento"
            value={formatDate(customer.data_de_vencimento)}
            sub={days >= 0 ? `${days} dia(s) restante(s)` : `Vencido há ${Math.abs(days)} dia(s)`}
          />
          <SummaryCard
            icon={<CreditCard className="h-5 w-5 text-secondary" />}
            label="Plano"
            value={customer.plan?.name || "—"}
            sub={`${formatCurrency(planValue)}/mês`}
          />
          <SummaryCard
            icon={<Monitor className="h-5 w-5 text-accent" />}
            label="Telas"
            value={String(customer.telas || "—")}
            sub="simultâneas"
          />
        </div>

        {/* Renewal Section */}
        <RenewalSection />

        {/* My Plan Section */}
        <MyPlanSection />

        {/* Referral Section */}
        <div className="card-elevated p-6">
          <h2 className="text-lg font-bold text-foreground mb-2">Indique e ganhe</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Indique amigos e ganhe dias grátis a cada indicação ativa! 🎉
          </p>
          <div className="p-3 bg-muted rounded-lg text-sm text-foreground font-mono mb-4 break-all">
            {referralLink}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleCopyRef}
              className="btn-primary-gradient px-4 py-2.5 text-sm inline-flex items-center justify-center gap-1.5"
            >
              {copiedRef ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedRef ? "Copiado!" : "Copiar link"}
            </button>
            <button
              onClick={shareWhatsApp}
              className="px-4 py-2.5 text-sm border-[1.5px] border-success text-success rounded-lg hover:bg-success/5 inline-flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Share2 className="h-4 w-4" /> Compartilhar no WhatsApp
            </button>
          </div>
        </div>

        {/* Invoices Section */}
        <div className="card-elevated p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Faturas</h2>
            <button
              onClick={handleGeneratePayment}
              disabled={generatingLink}
              className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1 disabled:opacity-60"
            >
              {generatingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              Gerar nova fatura
            </button>
          </div>

          {invoicesQuery.isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : invoicesQuery.isError ? (
            <p className="text-sm text-destructive">Erro ao carregar faturas.</p>
          ) : Array.isArray(invoices) && invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((inv: any) => {
                const isPending = ["pendente", "pending", "em aberto"].includes(
                  (inv.status || "").toLowerCase()
                );
                const isPaid = ["pago", "paid"].includes((inv.status || "").toLowerCase());
                return (
                  <div
                    key={inv.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 rounded-xl border border-border"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {formatDate(inv.issuance_date || inv.created_at)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(inv.total_amount || inv.amount || 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={inv.status || "pendente"} />
                      {isPending && inv.checkout_url && (
                        <a
                          href={inv.checkout_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary-gradient px-3 py-1.5 text-xs inline-flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" /> Pagar
                        </a>
                      )}
                      {isPaid && inv.checkout_url && (
                        <a
                          href={inv.checkout_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <FileText className="h-3 w-3" /> Ver comprovante
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma fatura encontrada.</p>
          )}
        </div>
      </main>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
          <div className="card-elevated p-6 w-full max-w-md relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setPaymentModal(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-foreground mb-2">Fatura gerada!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Use o link abaixo para realizar o pagamento:
            </p>
            <div className="p-3 bg-muted rounded-lg text-xs text-foreground font-mono mb-4 break-all">
              {paymentModal}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href={paymentModal}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary-gradient px-5 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="h-4 w-4" /> Pagar agora
              </a>
              <button
                onClick={() => copyToClipboard(paymentModal)}
                className="px-5 py-2.5 text-sm border-[1.5px] border-secondary text-secondary rounded-lg hover:bg-secondary/5 inline-flex items-center justify-center gap-1.5 transition-all"
              >
                <Copy className="h-4 w-4" /> Copiar link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) => (
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
