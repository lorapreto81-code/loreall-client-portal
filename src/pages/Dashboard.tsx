import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LogOut,
  AlertTriangle, Sun, Moon, Gift, MessageCircle, Film
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { formatDate, daysUntil } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import RenewalBottomSheet from "@/components/RenewalBottomSheet";

import { useTheme } from "@/hooks/use-theme";
import NoticeBanner from "@/components/NoticeBanner";
import ExpirationPopup from "@/components/ExpirationPopup";
import LaunchesBanner from "@/components/LaunchesBanner";
import ReferralSheet from "@/components/ReferralSheet";
const logo = "/logo.png";
const WHATSAPP_NUMBER = "5583985591952";

/** Returns color for days remaining */
const getDaysColor = (days: number): string => {
  if (days < 0) return "#E24B4A";
  if (days < 7) return "#F09595";
  if (days <= 15) return "#FAC775";
  return "#5DCAA5";
};

/** Returns correct text for days remaining */
const getDaysText = (days: number): string => {
  if (days < 0) return "Acesso vencido";
  if (days === 0) return "Vence hoje!";
  if (days === 1) return "Falta 1 dia";
  return `Faltam ${days} dias`;
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
      {/* 1. HEADER */}
      <header className="bg-card sticky top-0 z-10" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center justify-between px-4 py-2.5 max-w-[480px] mx-auto">
          <img src={logo} alt="Loreall Play TV" style={{ height: 36, width: "auto" }} />
          <div className="flex items-center gap-1.5">
            {/* AJUSTE 5 — Greeting */}
            <span className="text-[13px] text-muted-foreground hidden min-[320px]:inline">
              Olá, {firstName(customer.name)}!
            </span>
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
        {isLoading ? (
          <div className="card-elevated p-5 space-y-3">
            <div className="skeleton-bar h-3 w-32" />
            <div className="skeleton-bar h-7 w-48" />
            <div className="skeleton-bar h-4 w-36" />
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4" style={{ borderTop: "1px solid hsl(var(--border))" }}>
              <div className="space-y-1.5"><div className="skeleton-bar h-3 w-12" /><div className="skeleton-bar h-4 w-24" /></div>
              <div className="space-y-1.5"><div className="skeleton-bar h-3 w-12" /><div className="skeleton-bar h-4 w-20" /></div>
            </div>
          </div>
        ) : (
          <div className="card-elevated p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Próximo vencimento</p>
            <p className="text-2xl font-bold text-foreground">{formatDate(customer.data_de_vencimento)}</p>
            <p className="text-sm font-medium mt-0.5" style={{ color: getDaysColor(days) }}>
              {getDaysText(days)}
            </p>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4" style={{ borderTop: "1px solid hsl(var(--border))" }}>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Plano</p>
                <p className="text-sm font-semibold text-foreground">{customer.plan?.name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Telas</p>
                <p className="text-sm font-semibold text-foreground">{telasLabel(customer.telas)}</p>
              </div>
            </div>
          </div>
        )}

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
            Seu acesso vence em {days === 1 ? "1 dia" : `${days} dias`}. Renove agora!
          </div>
        )}

        {/* 4. DOIS BOTÕES DE AÇÃO */}
        <button
          onClick={() => setRenewalOpen(true)}
          className="btn-primary-gradient font-semibold text-sm flex items-center justify-center gap-2 w-full"
          style={{ minHeight: 64, borderRadius: 16 }}
        >
          Renovar acesso
        </button>

        {/* 4.5 LANÇAMENTOS */}
        <LaunchesBanner />

        {/* 6. INDIQUE E GANHE */}
        <button
          onClick={() => setReferralOpen(true)}
          className="card-elevated p-5 card-referral text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
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

        {/* 7. SUPORTE E PEDIR CONTEÚDO */}
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

        <div className="h-4" />
      </main>

      <ExpirationPopup
        days={days}
        customerUsuario={customer.usuario}
        onRenew={() => setRenewalOpen(true)}
        isReady={!isLoading}
      />
      <RenewalBottomSheet open={renewalOpen} onClose={handleRenewalClose} />
      <ReferralSheet open={referralOpen} onClose={() => setReferralOpen(false)} />
      
    </div>
  );
};

export default Dashboard;
