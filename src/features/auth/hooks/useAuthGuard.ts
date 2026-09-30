import { useAuthStore } from "@/store/authStore";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";

export const useAuthGuard = () => {
  const { customer, isAuthenticated, logout, scope, exitCheckout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Renewal-link sessions never grant access to the full customer area;
    // restore the prior full session if one was saved, otherwise send to login.
    if (scope === "checkout") {
      if (!exitCheckout()) navigate("/login", { replace: true });
      return;
    }
    if (!isAuthenticated || !customer) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, customer, navigate, scope, exitCheckout]);

  useEffect(() => {
    const handler = () => {
      toast.error("Sessão expirada. Faça login novamente.");
      logout();
      navigate("/login");
    };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, [logout, navigate]);

  return { customer, isAuthenticated, logout };
};
