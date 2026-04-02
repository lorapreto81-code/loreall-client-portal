import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
const logo = "/logo.png";

const Welcome = () => {
  const navigate = useNavigate();
  const customer = useAuthStore((s) => s.customer);
  const [fadeOut, setFadeOut] = useState(false);

  const firstName = (customer?.name || "").split(" ")[0];

  useEffect(() => {
    if (!customer) {
      navigate("/login", { replace: true });
      return;
    }
    const t1 = setTimeout(() => setFadeOut(true), 1200);
    const t2 = setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [navigate, customer]);

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center bg-background px-4 transition-opacity duration-300 ${fadeOut ? "opacity-0" : "opacity-100"}`}
    >
      <img src={logo} alt="Loreall Play TV" style={{ width: 80, height: "auto" }} className="mb-5" />
      <h1 className="text-[22px] font-semibold text-foreground mb-1">
        Bem-vindo, {firstName}!
      </h1>
      <p className="text-sm text-muted-foreground mb-6">Carregando sua conta...</p>
      <div className="welcome-spinner" />
    </div>
  );
};

export default Welcome;
