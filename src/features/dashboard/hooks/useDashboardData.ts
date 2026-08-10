import { useState } from "react";
import { useAuthGuard } from "@/features/auth/hooks/useAuthGuard";
import { daysUntil } from "@/lib/format";

export const useDashboardData = () => {
  const { customer, isAuthenticated, logout } = useAuthGuard();
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountTab, setAccountTab] = useState<"dados" | "faturas">("dados");
  const [menuOpen, setMenuOpen] = useState(false);

  const days = customer ? daysUntil(customer.data_de_vencimento) : 0;
  
  const rawPhone = String((customer as any)?.whatsapp || (customer as any)?.celular || "").replace(/\D/g, "");
  const hasValidPhone = rawPhone.length >= 10;
  const hasValidName = (customer?.name || "").trim().split(" ").filter(Boolean).length >= 2;
  const hasEmailValid = !!String((customer as any)?.email || "").trim();
  const profileIncomplete = !!customer && (!hasValidPhone || !hasValidName || !hasEmailValid);

  return {
    customer,
    days,
    profileIncomplete,
    renewalOpen, setRenewalOpen,
    referralOpen, setReferralOpen,
    accountOpen, setAccountOpen,
    accountTab, setAccountTab,
    menuOpen, setMenuOpen,
    logout
  };
};