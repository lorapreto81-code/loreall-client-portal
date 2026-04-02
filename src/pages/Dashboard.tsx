import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LogOut, Copy, Check, Share2, ChevronDown, ChevronUp,
  AlertTriangle, Sun, Moon, Gift
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { getCustomerInvoices } from "@/lib/api";
import { formatCurrency, formatDate, daysUntil } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import RenewalBottomSheet from "@/components/RenewalBottomSheet";
import ChangePlanBottomSheet from "@/components/ChangePlanBottomSheet";
import { useTheme } from "@/hooks/use-theme";
const logo = "/logo.png";

const Dashboard = () => {
  const { customer, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);

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
  const invoices: any[] = invoicesQuery.data?.data || invoicesQuery.data || [];

  // AJUSTE 3: Smart invoice status — if customer expiry is in the future,
  // pending invoices are treated as "paid" (visual only)
  const customerNotExpired = days >= 0;
  const processedInvoices = invoices.map((inv: any) => {
    const invStatus = (inv.status || "").toLowerCase();
    const isPending = ["pendente", "pending", "em aberto"].includes(invStatus);
    if (isPending && customerNotExpired) {
      return { ...inv, _displayStatus: "pago", _hidePay: true };
    }
    return { ...inv, _displayStatus: inv.status, _hidePay: false };
  });

  const visibleInvoices = showAllInvoices ? processedInvoices.slice(0, 10) : processedInvoices.slice(0, 3);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 1. HEADER */}
      <header className="bg-card sticky top-0 z-10" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center justify-between px-4 py-2.5 max-w-[480px] mx-auto">
          <img src={logo} alt="Loreall Play TV" style={{ height: 36, width: "auto" }} />
          <div className="flex items-center gap-1.5">
            <StatusBadge status={status} />
            <button
              onClick={toggleTheme}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
              style={{ minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
              style={{ minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <LogOut className="h-[18px] w-[18px]" />
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
          <div className="flex items-center gap-2.5 rounded-xl p-4 text-sm font-medium bg-destructive/10 text-destructive-foreground">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Seu acesso está vencido. Renove para continuar assistindo.
          </div>
        )}
        {days >= 0 && days < 7 && (
          <div className="flex items-center gap-2.5 rounded-xl p-4 text-sm font-medium bg-warning/10 text-warning-foreground">
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
            onClick={() => setChangePlanOpen(true)}
            className="bg-muted font-semibold text-sm text-secondary-foreground flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] border border-secondary"
            style={{ minHeight: 64, borderRadius: 16 }}
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
          ) : Array.isArray(processedInvoices) && processedInvoices.length > 0 ? (
            <>
              <div className="space-y-2">
                {visibleInvoices.map((inv: any) => {
                  const dateStr = inv.issuance_date || inv.created_at || "";
                  const d = new Date(dateStr);
                  const monthYear = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
                  const showPay = !inv._hidePay && ["pendente", "pending", "em aberto"].includes((inv.status || "").toLowerCase()) && inv.checkout_url;

                  return (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-border"
                      style={{ minHeight: 44 }}
                    >
                      <span className="text-sm font-medium text-foreground capitalize">{monthYear}</span>
                      <span className="text-sm text-muted-foreground">{formatCurrency(inv.total_amount || inv.amount || 0)}</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={inv._displayStatus || "pendente"} />
                        {showPay && (
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
              {processedInvoices.length > 3 && (
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

        {/* 6. INDIQUE E GANHE — Em breve */}
        <div className="card-elevated p-5" style={{ opacity: 0.6, cursor: "default" }}>
          <div className="flex items-center gap-2 mb-1">
            <Gift className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-base font-bold text-foreground">Indique e ganhe</h2>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
              Em breve
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Em breve disponível para você!
          </p>
        </div>

        <div className="h-4" />
      </main>

      <RenewalBottomSheet open={renewalOpen} onClose={() => setRenewalOpen(false)} />
      <ChangePlanBottomSheet open={changePlanOpen} onClose={() => setChangePlanOpen(false)} />
    </div>
  );
};

export default Dashboard;
