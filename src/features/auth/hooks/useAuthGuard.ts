import { useAuthStore } from "@/store/authStore";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";

export const useAuthGuard = () => {
  const { customer, isAuthenticated, logout, scope } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Renewal-link sessions never grant access to the full customer area.
    if (scope === "checkout") {
      logout();
      navigate("/login", { replace: true });
      return;
    }
    if (!isAuthenticated || !customer) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, customer, navigate, scope, logout]);

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
