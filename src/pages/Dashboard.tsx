import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LogOut,
  AlertTriangle, Sun, Moon, Gift, MessageCircle, Film,
  CalendarDays, Monitor, Zap, User, ChevronRight, CheckCircle2
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { formatDate, daysUntil } from "@/lib/format";
import RenewalBottomSheet from "@/components/RenewalBottomSheet";

import { useTheme } from "@/hooks/use-theme";
import NoticeBanner from "@/components/NoticeBanner";
import ExpirationPopup from "@/components/ExpirationPopup";
import LaunchesBanner from "@/components/LaunchesBanner";
import ReferralSheet from "@/components/ReferralSheet";
import ProfileSheet from "@/components/ProfileSheet";
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
  const [profileOpen, setProfileOpen] = useState(false);
  
  

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

  if (!customer) return null;

  const days = daysUntil(customer.data_de_vencimento);
  const status = days < 0 ? "vencido" : (customer.status?.toLowerCase() || "ativo");

  // Dados do cliente — checagem de completude
  const rawPhone = String((customer as any).whatsapp || (customer as any).celular || "").replace(/\D/g, "");
  const hasValidPhone = rawPhone.length >= 10; // exige DDD + número
  const hasValidName = (customer.name || "").trim().split(" ").filter(Boolean).length >= 2;
  const profileIncomplete = !hasValidPhone || !hasValidName;

  // Auto-abre "Meus dados" 1x por sessão quando incompleto
  useEffect(() => {
    if (!profileIncomplete) return;
    const key = `loreall_profile_prompted_${customer.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    const t = setTimeout(() => setProfileOpen(true), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileIncomplete, customer.id]);

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
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
              style={{ minHeight: 40, minWidth: 40, display: "flex", alignItems: "center", justifyContent: "center" }}
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
              style={{ minHeight: 40, minWidth: 40, display: "flex", alignItems: "center", justifyContent: "center" }}
              title="Sair"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 max-w-[480px] mx-auto" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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

        {/* LANÇAMENTOS */}
        <div>
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <Film className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Lançamentos</h2>
          </div>
          <LaunchesBanner />
        </div>

        {/* MEUS DADOS — nome + WhatsApp formatado */}
        <button
          onClick={() => setProfileOpen(true)}
          className="card-elevated p-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99] w-full flex items-center gap-3"
        >
          <div className="rounded-full p-2.5 bg-primary/10 shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{customer.name || "Meus dados"}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {(() => {
                const raw = String((customer as any).whatsapp || (customer as any).celular || "");
                return raw ? formatPhone(raw) : "Toque para adicionar seu WhatsApp";
              })()}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>


        {/* INDIQUE E GANHE */}
        <button
          onClick={() => setReferralOpen(true)}
          className="card-elevated p-5 card-referral text-left transition-all hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden"
        >
          <div className="flex items-center gap-2 mb-1">
            <Gift className="h-5 w-5 referral-icon" />
            <h2 className="text-base font-medium referral-title">Indique e ganhe</h2>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full referral-badge">
              +30 dias
            </span>
          </div>
          <p className="text-sm referral-subtitle">
            Cada amigo que renovar com seu código te dá 1 mês grátis. Sem limite!
          </p>
        </button>

        {/* SUPORTE E PEDIR CONTEÚDO */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=Olá!%20Preciso%20de%20suporte.%20Meu%20usuário%20é%3A%20${encodeURIComponent(customer.usuario)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-footer text-sm flex items-center justify-center gap-2 transition-all hover:opacity-80"
            style={{ height: 48, borderRadius: 12 }}
          >
            <MessageCircle className="h-4 w-4" />
            Suporte
          </a>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=Olá!%20Quero%20pedir%20um%20conteúdo.%20Meu%20usuário%20é%3A%20${encodeURIComponent(customer.usuario)}%20-%20Conteúdo%3A%20`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-footer text-sm flex items-center justify-center gap-2 transition-all hover:opacity-80"
            style={{ height: 48, borderRadius: 12 }}
          >
            <Film className="h-4 w-4" />
            Pedir conteúdo
          </a>
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
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
};

export default Dashboard;
