import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LogOut, Copy, Check, Share2, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, ExternalLink, FileText, X
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { getCustomerInvoices } from "@/lib/api";
import { formatCurrency, formatDate, daysUntil } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import MyPlanSection from "@/components/MyPlanSection";
import RenewalBottomSheet from "@/components/RenewalBottomSheet";
import logo from "@/assets/loreall-logo.png";

const Dashboard = () => {
  const { customer, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const [copiedRef, setCopiedRef] = useState(false);
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

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
  const status = days < 0 ? "vencido" : (customer.status?.toLowerCase() || "ativo");
  const referralLink = `https://loreallplay.com.br/ref/${customer.usuario}`;
  const invoices: any[] = invoicesQuery.data?.data || invoicesQuery.data || [];
  const visibleInvoices = showAllInvoices ? invoices.slice(0, 10) : invoices.slice(0, 3);

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

  return (
    <div className="min-h-screen bg-background">
      {/* 1. HEADER */}
      <header className="bg-card sticky top-0 z-10" style={{ borderBottom: "0.5px solid hsl(var(--border))" }}>
        <div className="flex items-center justify-between px-4 py-2.5 max-w-[480px] mx-auto">
          <img src={logo} alt="Loreall Play TV" style={{ height: 36, width: "auto" }} />
          <div className="flex items-center gap-2.5">
            <StatusBadge status={status} />
            <button
              onClick={handleLogout}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
              style={{ minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-3 max-w-[480px] mx-auto" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* 2. CARD DE STATUS */}
        <div className="card-elevated p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Próximo vencimento</p>
          <p className="text-2xl font-bold text-foreground">{formatDate(customer.data_de_vencimento)}</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {days >= 0 ? `Faltam ${days} dia(s)` : `Vencido há ${Math.abs(days)} dia(s)`}
          </p>
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Plano</p>
              <p className="text-sm font-semibold text-foreground">{customer.plan?.name || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Telas</p>
              <p className="text-sm font-semibold text-foreground">{customer.telas || "—"} simultânea(s)</p>
            </div>
          </div>
        </div>

        {/* 3. BANNER DE ALERTA */}
        {days < 0 && (
          <div className="flex items-center gap-2.5 bg-destructive/10 text-destructive rounded-xl p-4 text-sm font-medium">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Seu acesso está vencido. Renove para continuar assistindo.
          </div>
        )}
        {days >= 0 && days < 7 && (
          <div className="flex items-center gap-2.5 bg-warning/10 text-warning rounded-xl p-4 text-sm font-medium">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Seu acesso vence em {days} dia(s). Renove agora!
          </div>
        )}

        {/* 4. DOIS BOTÕES DE AÇÃO */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setRenewalOpen(true)}
            className="btn-primary-gradient font-semibold text-sm flex items-center justify-center gap-2"
            style={{ minHeight: 64, borderRadius: 16 }}
          >
            Renovar acesso
          </button>
          <button
            onClick={() => setPlanOpen(!planOpen)}
            className="bg-card font-semibold text-sm text-foreground flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ minHeight: 64, borderRadius: 16, border: "1.5px solid hsl(var(--secondary))" }}
          >
            Trocar plano
          </button>
        </div>

        {/* 5. FATURAS RECENTES */}
        <div className="card-elevated p-5">
          <h2 className="text-base font-bold text-foreground mb-3">Faturas recentes</h2>
          {invoicesQuery.isLoading ? (
            <div className="space-y-2.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : invoicesQuery.isError ? (
            <p className="text-sm text-destructive">Erro ao carregar faturas.</p>
          ) : Array.isArray(invoices) && invoices.length > 0 ? (
            <>
              <div className="space-y-2">
                {visibleInvoices.map((inv: any) => {
                  const isPending = ["pendente", "pending", "em aberto"].includes((inv.status || "").toLowerCase());
                  const dateStr = inv.issuance_date || inv.created_at || "";
                  const d = new Date(dateStr);
                  const monthYear = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });

                  return (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-border"
                      style={{ minHeight: 44 }}
                    >
                      <span className="text-sm font-medium text-foreground capitalize">{monthYear}</span>
                      <span className="text-sm text-muted-foreground">{formatCurrency(inv.total_amount || inv.amount || 0)}</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={inv.status || "pendente"} />
                        {isPending && inv.checkout_url && (
                          <a
                            href={inv.checkout_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary-gradient px-3 py-1.5 text-xs inline-flex items-center gap-1"
                          >
                            Pagar
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {invoices.length > 3 && (
                <button
                  onClick={() => setShowAllInvoices(!showAllInvoices)}
                  className="mt-3 text-sm font-medium text-secondary hover:underline inline-flex items-center gap-1 transition-colors"
                  style={{ minHeight: 44 }}
                >
                  {showAllInvoices ? (
                    <><ChevronUp className="h-4 w-4" /> Mostrar menos</>
                  ) : (
                    <><ChevronDown className="h-4 w-4" /> Ver todas</>
                  )}
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma fatura encontrada.</p>
          )}
        </div>

        {/* 6. INDIQUE E GANHE */}
        <div className="card-elevated p-5">
          <h2 className="text-base font-bold text-foreground mb-1">Indique e ganhe</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Indique amigos e ganhe dias grátis! 🎉
          </p>
          <div className="p-3 bg-muted rounded-lg text-xs text-foreground font-mono mb-3 break-all">
            {referralLink}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopyRef}
              className="btn-primary-gradient px-4 py-2.5 text-sm flex-1 inline-flex items-center justify-center gap-1.5"
              style={{ minHeight: 44 }}
            >
              {copiedRef ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedRef ? "Copiado!" : "Copiar link"}
            </button>
            <button
              onClick={shareWhatsApp}
              className="px-4 py-2.5 text-sm flex-1 rounded-lg inline-flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ minHeight: 44, border: "1.5px solid hsl(var(--success))", color: "hsl(var(--success))" }}
            >
              <Share2 className="h-4 w-4" /> WhatsApp
            </button>
          </div>
        </div>

        {/* 7. TROCAR PLANO (accordion) */}
        <div className="card-elevated overflow-hidden">
          <button
            onClick={() => setPlanOpen(!planOpen)}
            className="w-full flex items-center justify-between p-5 text-left"
            style={{ minHeight: 44 }}
          >
            <span className="text-base font-bold text-foreground">Adicionar ou remover telas</span>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${planOpen ? "rotate-180" : ""}`}
            />
          </button>
          <div
            className="overflow-hidden transition-all duration-200 ease-out"
            style={{ maxHeight: planOpen ? 800 : 0, opacity: planOpen ? 1 : 0 }}
          >
            <div className="px-5 pb-5">
              <MyPlanSection />
            </div>
          </div>
        </div>

        <div className="h-4" />
      </main>

      {/* Bottom sheet: Renovar acesso */}
      <RenewalBottomSheet open={renewalOpen} onClose={() => setRenewalOpen(false)} />
    </div>
  );
};

export default Dashboard;
