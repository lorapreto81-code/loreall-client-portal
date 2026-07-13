import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LogOut,
  AlertTriangle, Sun, Moon, Gift, MessageCircle, Film,
  CalendarDays, Monitor, Zap, User, ChevronRight, Receipt, HelpCircle, Plus,
  Mail, X, Download
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { formatDate, daysUntil } from "@/lib/format";
import RenewalBottomSheet from "@/components/RenewalBottomSheet";

import { useTheme } from "@/hooks/use-theme";
import NoticeBanner from "@/components/NoticeBanner";
import ExpirationPopup from "@/components/ExpirationPopup";
import LaunchesBanner from "@/components/LaunchesBanner";
import ReferralSheet from "@/components/ReferralSheet";
import MyAccountSheet from "@/components/MyAccountSheet";
const logo = "/logo.png";
const WHATSAPP_NUMBER = "5583985591952";

/** Formats a Brazilian phone number for display. */
const formatPhone = (raw: string): string => {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  return String(raw || "");
};

/** Returns color for days remaining */
const getDaysColor = (days: number): string => {
  if (days < 0) return "#E24B4A";
  if (days < 7) return "#F09595";
  if (days <= 15) return "#FAC775";
  return "#5DCAA5";
};

/** Short status pill for the header. */
const getStatusPill = (days: number): { label: string; bg: string; color: string } => {
  if (days < 0) return { label: "Vencido", bg: "rgba(226,75,74,0.15)", color: "#E24B4A" };
  if (days === 0) return { label: "Vence hoje", bg: "rgba(240,149,149,0.18)", color: "#E24B4A" };
  if (days === 1) return { label: "1 dia", bg: "rgba(250,199,117,0.20)", color: "#B47700" };
  if (days < 7) return { label: `${days} dias`, bg: "rgba(250,199,117,0.20)", color: "#B47700" };
  return { label: "Ativo", bg: "rgba(93,202,165,0.15)", color: "#2E9A73" };
};

/** Plural for telas */
const telasLabel = (n: number | string): string => {
  const num = typeof n === "number" ? n : parseInt(String(n), 10) || 1;
  return num === 1 ? "1 simultânea" : `${num} simultâneas`;
};

/** First name */
const firstName = (name: string): string => (name || "").split(" ")[0];

const Dashboard = () => {
  const { customer, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountTab, setAccountTab] = useState<"dados" | "faturas">("dados");

  const openAccount = (tab: "dados" | "faturas") => {
    setAccountTab(tab);
    setAccountOpen(true);
  };
  
  

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

  // Dados do cliente — checagem de completude (hooks precisam vir antes de qualquer early return)
  const rawPhone = String((customer as any)?.whatsapp || (customer as any)?.celular || "").replace(/\D/g, "");
  const hasValidPhone = rawPhone.length >= 10; // exige DDD + número
  const hasValidName = (customer?.name || "").trim().split(" ").filter(Boolean).length >= 2;
  const profileIncomplete = !!customer && (!hasValidPhone || !hasValidName);

  const hasEmail = !!String((customer as any)?.email || "").trim();
  const emailBannerKey = customer ? `loreall_email_banner_dismissed_${customer.id}` : "";
  const [emailBannerDismissed, setEmailBannerDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined" || !emailBannerKey) return false;
    return localStorage.getItem(emailBannerKey) === "1";
  });
  const showEmailBanner = !!customer && !hasEmail && !emailBannerDismissed && !profileIncomplete;
  const dismissEmailBanner = () => {
    if (emailBannerKey) localStorage.setItem(emailBannerKey, "1");
    setEmailBannerDismissed(true);
  };

  // Auto-abre "Meus dados" 1x por sessão quando incompleto
  useEffect(() => {
    if (!customer || !profileIncomplete) return;
    const key = `loreall_profile_prompted_${customer.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    const t = setTimeout(() => openAccount("dados"), 600);
    return () => clearTimeout(t);
  }, [profileIncomplete, customer]);

  if (!customer) return null;

  const days = daysUntil(customer.data_de_vencimento);
  const status = days < 0 ? "vencido" : (customer.status?.toLowerCase() || "ativo");

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleRenewalClose = () => {
    setRenewalOpen(false);
    queryClient.invalidateQueries({ queryKey: ["invoices", customer.id] });
  };

  const isLoading = false;

  return (
    <div className="min-h-screen bg-background">
      <NoticeBanner />

      {/* HEADER — só identidade e ações; status fica no card abaixo */}
      <header className="bg-card/80 backdrop-blur-md sticky top-0 z-10 border-b border-border">
        <div className="flex items-center justify-between px-4 py-2.5 max-w-[480px] mx-auto">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={logo} alt="Loreall Play TV" style={{ height: 32, width: "auto" }} />
            <div className="hidden min-[360px]:block min-w-0">
              <div className="text-[11px] text-muted-foreground leading-tight">Área do Cliente</div>
              <div className="text-[13px] font-semibold text-foreground leading-tight truncate">Olá, {firstName(customer.name)}!</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="p-2 text-foreground bg-muted/60 hover:bg-muted transition-colors rounded-full border border-border"
              style={{ minHeight: 40, minWidth: 40, display: "flex", alignItems: "center", justifyContent: "center" }}
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors rounded-full"
              style={{ minHeight: 40, minWidth: 40, display: "flex", alignItems: "center", justifyContent: "center" }}
              title="Sair"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 max-w-[480px] mx-auto" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* CONFIRME SEUS DADOS — prioridade máxima quando incompletos */}
        {profileIncomplete && (
          <button
            onClick={() => openAccount("dados")}
            className="w-full text-left rounded-xl p-4 flex items-center gap-3 border-2 animate-in fade-in slide-in-from-top duration-300"
            style={{
              borderColor: "hsl(var(--warning))",
              background: "hsl(var(--warning) / 0.08)",
            }}
          >
            <div className="rounded-full p-2.5 shrink-0" style={{ background: "hsl(var(--warning) / 0.18)" }}>
              <AlertTriangle className="h-4 w-4" style={{ color: "hsl(var(--warning))" }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Confirme seus dados</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {!hasValidPhone
                  ? "Adicione seu WhatsApp com DDD para receber lembretes de renovação."
                  : "Verifique se seu nome está completo."}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        )}

        {/* CADASTRO DE E-MAIL — banner dispensável, só quando perfil já está OK */}
        {showEmailBanner && (
          <div
            className="w-full rounded-xl p-3.5 flex items-center gap-3 border animate-in fade-in slide-in-from-top duration-300 relative"
            style={{
              borderColor: "hsl(var(--primary) / 0.35)",
              background: "hsl(var(--primary) / 0.06)",
            }}
          >
            <div className="rounded-full p-2 shrink-0 bg-primary/15">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <button
              onClick={() => openAccount("dados")}
              className="min-w-0 flex-1 text-left"
            >
              <p className="text-sm font-semibold text-foreground">Cadastre seu e-mail oficial</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Em breve o login será por e-mail. Adicione agora e não perca o acesso.
              </p>
            </button>
            <button
              onClick={dismissEmailBanner}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              aria-label="Dispensar"
              style={{ minHeight: 32, minWidth: 32 }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* CARD DO PLANO — status único, sem duplicar em outro lugar */}
        {(() => {
          const pill = getStatusPill(days);
          return (
            <div className="card-elevated p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent" />

              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Seu plano</p>
                  <p className="text-xl font-bold text-foreground leading-tight truncate">{customer.plan?.name || "—"}</p>
                </div>
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{ background: pill.bg, color: pill.color }}
                >
                  {pill.label.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3" style={{ borderTop: "1px solid hsl(var(--border))" }}>
                <div className="flex items-start gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground mb-0.5">Vence em</p>
                    <p className="text-sm font-semibold text-foreground">{formatDate(customer.data_de_vencimento)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Monitor className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground mb-0.5">Telas</p>
                    <p className="text-sm font-semibold text-foreground">{telasLabel(customer.telas)}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ALERTA — apenas quando urgente; texto natural */}
        {days < 0 ? (
          <div className="flex items-center gap-2.5 rounded-xl p-4 text-sm font-medium bg-destructive/10 text-destructive-foreground border border-destructive/20">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Seu acesso está vencido. Renove para continuar assistindo.
          </div>
        ) : days === 0 ? (
          <div className="flex items-center gap-2.5 rounded-xl p-4 text-sm font-medium bg-warning/10 text-warning-foreground border border-warning/20">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Seu acesso vence hoje. Renove agora para não ficar sem sinal.
          </div>
        ) : days < 7 ? (
          <div className="flex items-center gap-2.5 rounded-xl p-4 text-sm font-medium bg-warning/10 text-warning-foreground border border-warning/20">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {days === 1 ? "Falta 1 dia" : `Faltam ${days} dias`} para o vencimento. Renove agora!
          </div>
        ) : null}

        {/* CTA PRINCIPAL */}
        <button
          onClick={() => setRenewalOpen(true)}
          className="group btn-primary-gradient font-semibold text-sm flex items-center justify-center gap-2 w-full relative overflow-hidden"
          style={{ minHeight: 60, borderRadius: 16 }}
        >
          <Zap className="h-5 w-5 group-hover:scale-110 transition-transform" />
          Renovar acesso
        </button>


        {/* INDIQUE E GANHE */}
        <button
          onClick={() => setReferralOpen(true)}
          className="card-elevated p-5 card-referral text-left transition-all hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden"
        >
          <div className="flex items-center gap-2 mb-1">
            <Gift className="h-5 w-5 referral-icon" />
            <h2 className="text-base font-medium referral-title">Indique e ganhe</h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full referral-badge inline-flex items-center gap-1">
              +30 dias
              <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-[1px] rounded-full bg-emerald-500 text-white">
                Grátis
              </span>
            </span>

          </div>
          <p className="text-sm referral-subtitle">
            Cada amigo que renovar com seu código te dá 1 mês grátis. Sem limite!
          </p>
        </button>

        {/* MINHA CONTA — entrada única para dados, faturas, suporte e pedidos */}
        <button
          onClick={() => openAccount("dados")}
          className="card-elevated w-full p-4 text-left transition-all hover:scale-[1.005] active:scale-[0.99] relative"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-3 bg-gradient-to-br from-primary/20 to-primary/5 shrink-0 border border-primary/20">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Minha conta</p>
                {profileIncomplete && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse"
                    style={{ background: "hsl(var(--warning) / 0.18)", color: "hsl(var(--warning))" }}
                  >
                    AÇÃO
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Gerencie perfil, faturas e ajuda
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>

          <div className="mt-3 pt-3 border-t border-border flex items-center justify-around gap-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <User className="h-3.5 w-3.5" /> Dados
            </div>
            <span className="text-muted-foreground/30">·</span>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" /> Faturas
            </div>
            <span className="text-muted-foreground/30">·</span>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <HelpCircle className="h-3.5 w-3.5" /> Suporte
            </div>
            <span className="text-muted-foreground/30">·</span>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Plus className="h-3.5 w-3.5" /> Pedir
            </div>
          </div>
        </button>

        {/* COMO INSTALAR */}
        <button
          onClick={() => navigate("/instalacao")}
          className="card-elevated w-full p-4 text-left transition-all hover:scale-[1.005] active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-3 bg-gradient-to-br from-accent/20 to-accent/5 shrink-0 border border-accent/20">
              <Download className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Como instalar</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Apps recomendados para Smart TV, TV Box e celular
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </button>

        {/* LANÇAMENTOS — informativo, no final */}
        <div>
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <Film className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Lançamentos</h2>
          </div>
          <LaunchesBanner />
        </div>

        <div className="h-2" />

      </main>

      <ExpirationPopup
        days={days}
        customerUsuario={customer.usuario}
        onRenew={() => setRenewalOpen(true)}
        isReady={!isLoading}
      />
      <RenewalBottomSheet open={renewalOpen} onClose={handleRenewalClose} />
      <ReferralSheet open={referralOpen} onClose={() => setReferralOpen(false)} />
      <MyAccountSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        customerId={customer.id}
        initialTab={accountTab}
        customerUsuario={customer.usuario}
        whatsappNumber={WHATSAPP_NUMBER}
      />

    </div>
  );
};

export default Dashboard;
