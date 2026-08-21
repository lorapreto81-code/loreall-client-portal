import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Gift, LifeBuoy } from "lucide-react";
import { useActiveSubscription } from "@/features/dashboard/hooks/useActiveSubscription";

import { useTheme } from "@/hooks/use-theme";
import NoticeBanner from "@/components/NoticeBanner";
import ExpirationPopup, { shouldShow, canShow } from "@/components/ExpirationPopup";
import LaunchesBanner from "@/components/LaunchesBanner";
import ReferralSheet from "@/components/ReferralSheet";
import MyAccountSheet from "@/components/MyAccountSheet";
import RenewalBottomSheet from "@/components/RenewalBottomSheet";
import SupportSheet from "@/components/SupportSheet";


import { PlanCard } from "@/features/dashboard/components/PlanCard";
import { useDashboardData } from "@/features/dashboard/hooks/useDashboardData";
import { DashboardHeader } from "@/features/dashboard/components/DashboardHeader";
import { DashboardBanners } from "@/features/dashboard/components/DashboardBanners";
import { DashboardNavigation } from "@/features/dashboard/components/DashboardNavigation";

const Dashboard = () => {
  const {
    customer,
    days,
    profileIncomplete,
    renewalOpen, setRenewalOpen,
    referralOpen, setReferralOpen,
    accountOpen, setAccountOpen,
    accountTab, setAccountTab,
    menuOpen, setMenuOpen,
    logout
  } = useDashboardData();

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const [supportOpen, setSupportOpen] = useState(false);


  const openAccount = (tab: "dados" | "faturas") => {
    setAccountTab(tab);
    setAccountOpen(true);
    setMenuOpen(false);
  };

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

  useEffect(() => {
    if (!customer || !profileIncomplete) return;
    const key = `loreall_profile_prompted_${customer.id}`;
    if (sessionStorage.getItem(key)) return;
    const expirationType = shouldShow(days);
    if (expirationType && canShow(expirationType)) return; // deixa o pop-up de vencimento aparecer sozinho primeiro
    sessionStorage.setItem(key, "1");
    setTimeout(() => openAccount("dados"), 600);
  }, [profileIncomplete, customer, days]);

  if (!customer) return null;

  const handleRenewalClose = () => {
    setRenewalOpen(false);
    queryClient.invalidateQueries({ queryKey: ["invoices", customer.id] });
  };

  return (
    <div className="min-h-screen bg-background">
      <NoticeBanner />

      <DashboardHeader
        customer={customer}
        theme={theme}
        toggleTheme={toggleTheme}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        profileIncomplete={profileIncomplete}
      >
        <DashboardNavigation
          customer={customer}
          profileIncomplete={profileIncomplete}
          onOpenAccount={openAccount}
          onNavigate={navigate}
          onOpenReferral={() => setReferralOpen(true)}
          onOpenSupport={() => setSupportOpen(true)}

          onLogout={logout}
          onCloseMenu={() => setMenuOpen(false)}
        />
      </DashboardHeader>

      <main className="px-4 py-4 max-w-[480px] mx-auto flex flex-col gap-[14px]">
        <DashboardBanners
          profileIncomplete={profileIncomplete}
          hasValidPhone={String((customer as any)?.whatsapp || (customer as any)?.celular || "").replace(/\D/g, "").length >= 10}
          showEmailBanner={showEmailBanner}
          onOpenAccount={openAccount}
          onDismissEmailBanner={dismissEmailBanner}
        />

        <PlanCard customer={customer} days={days} onRenewClick={() => setRenewalOpen(true)} />

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

        <button
          onClick={() => setSupportOpen(true)}
          className="card-elevated p-5 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="flex items-center gap-2 mb-1">
            <LifeBuoy className="h-5 w-5 text-primary" />
            <h2 className="text-base font-medium text-foreground">Resolve alguns problemas!</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Renovou agora e o app não liberou? Feche e abra novamente ou desligue por 2 minutos. Veja o passo a passo.
          </p>
        </button>
      </main>


      <footer className="px-4 py-8 pb-12 max-w-[480px] mx-auto text-center space-y-6">
        <LaunchesBanner />
        <div className="pt-4 border-t border-white/5 opacity-40">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Loreall Play • 2026</p>
        </div>
      </footer>

      <RenewalBottomSheet open={renewalOpen} onClose={handleRenewalClose} />
      <ReferralSheet open={referralOpen} onClose={() => setReferralOpen(false)} />
      <MyAccountSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        customerId={customer.id}
        initialTab={accountTab}
        customerUsuario={customer.usuario}
      />
      <ExpirationPopup 
        days={days} 
        customerUsuario={customer.usuario} 
        onRenew={() => setRenewalOpen(true)} 
        isReady={true} 
      />
    </div>
  );
};

export default Dashboard;
