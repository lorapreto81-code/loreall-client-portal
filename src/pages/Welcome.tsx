import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
const logo = "/logo.png";

const Welcome = () => {
  const navigate = useNavigate();
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFadeOut(true), 1200);
    const t2 = setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [navigate]);

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center bg-background px-4 transition-opacity duration-300 ${fadeOut ? "opacity-0" : "opacity-100"}`}
    >
      <img src={logo} alt="Loreall Play TV" style={{ width: 80, height: "auto" }} className="mb-5" />
      <h1 className="text-[22px] font-semibold text-foreground mb-1 welcome-name" />
      <p className="text-sm text-muted-foreground mb-6">Carregando sua conta...</p>
      <div className="welcome-spinner" />
    </div>
  );
};

export default Welcome;
