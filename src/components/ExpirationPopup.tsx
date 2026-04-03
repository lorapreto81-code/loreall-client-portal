import { useEffect, useState } from "react";
import { Lock, Clock, CalendarDays, X } from "lucide-react";

const logo = "/logo.png";
const WHATSAPP_NUMBER = "5583985591952";

type PopupType = "expired" | "urgent" | "nearby" | null;

interface ExpirationPopupProps {
  days: number;
  customerUsuario: string;
  onRenew: () => void;
  isReady: boolean; // true when dashboard data finished loading
}

function shouldShow(days: number): PopupType {
  if (days < 0) return "expired";
  if (days <= 3) return "urgent";
  if (days <= 7) return "nearby";
  return null;
}

function canShow(type: PopupType): boolean {
  if (!type) return false;
  if (type === "expired") return true;

  if (type === "urgent") {
    const today = new Date().toISOString().slice(0, 10);
    const saved = localStorage.getItem("popup_urgente_data");
    return saved !== today;
  }

  if (type === "nearby") {
    return !sessionStorage.getItem("popup_proximo");
  }

  return false;
}

function markShown(type: PopupType) {
  if (type === "urgent") {
    localStorage.setItem("popup_urgente_data", new Date().toISOString().slice(0, 10));
  }
  if (type === "nearby") {
    sessionStorage.setItem("popup_proximo", "1");
  }
}

const daysLabel = (d: number) => {
  const abs = Math.abs(d);
  return abs === 1 ? "1 dia" : `${abs} dias`;
};

const configs = {
  expired: {
    overlayBg: "rgba(0,0,0,0.8)",
    closeable: false,
    icon: <Lock className="h-12 w-12" style={{ color: "#F09595" }} />,
    titleColor: "#F09595",
    borderDark: "#E24B4A",
    borderLight: "#E24B4A",
    getTitle: () => "Seu acesso está vencido",
    titleSize: 20,
    titleWeight: 700,
    subtitle: "Renove agora para continuar assistindo seus conteúdos favoritos.",
    primaryLabel: "Renovar agora",
    secondaryLabel: "Falar com suporte",
    secondaryIsWhatsApp: true,
  },
  urgent: {
    overlayBg: "rgba(0,0,0,0.7)",
    closeable: true,
    icon: <Clock className="h-12 w-12" style={{ color: "#FAC775" }} />,
    titleColor: "#FAC775",
    borderDark: "#FAC775",
    borderLight: "#F59E0B",
    getTitle: (d: number) => `Seu acesso vence em ${daysLabel(d)}!`,
    titleSize: 20,
    titleWeight: 700,
    subtitle: "Renove hoje e evite a interrupção do seu acesso.",
    primaryLabel: "Renovar agora",
    secondaryLabel: "Lembrar depois",
    secondaryIsWhatsApp: false,
  },
  nearby: {
    overlayBg: "rgba(0,0,0,0.5)",
    closeable: true,
    icon: <CalendarDays className="h-12 w-12" style={{ color: "#85B7EB" }} />,
    titleColor: "#85B7EB",
    borderDark: "#378ADD",
    borderLight: "#185FA5",
    getTitle: (d: number) => `Seu acesso vence em ${daysLabel(d)}`,
    titleSize: 18,
    titleWeight: 600,
    subtitle: "Que tal renovar com antecedência e garantir seu acesso sem interrupções?",
    primaryLabel: "Ver opções de renovação",
    secondaryLabel: "Agora não",
    secondaryIsWhatsApp: false,
  },
} as const;

export default function ExpirationPopup({ days, customerUsuario, onRenew, isReady }: ExpirationPopupProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [popupType, setPopupType] = useState<PopupType>(null);

  useEffect(() => {
    if (!isReady) return;
    const type = shouldShow(days);
    if (type && canShow(type)) {
      setPopupType(type);
      // small delay so dashboard renders first
      const t = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(t);
    }
  }, [isReady, days]);

  const close = () => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
      if (popupType) markShown(popupType);
      setPopupType(null);
    }, 200);
  };

  const handlePrimary = () => {
    close();
    // give time for close animation then open renewal
    setTimeout(onRenew, 250);
  };

  const handleSecondary = () => {
    if (popupType && configs[popupType].secondaryIsWhatsApp) {
      window.open(
        `https://wa.me/${WHATSAPP_NUMBER}?text=Olá!%20Preciso%20de%20suporte.%20Meu%20usuário%20é%3A%20${encodeURIComponent(customerUsuario)}`,
        "_blank"
      );
    }
    close();
  };

  if (!visible || !popupType) return null;

  const cfg = configs[popupType];
  const isDark = document.documentElement.classList.contains("dark");
  const borderColor = isDark ? cfg.borderDark : cfg.borderLight;
  const modalBg = isDark ? "#13132A" : "#FFFFFF";

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center px-4 transition-opacity duration-300 ${closing ? "opacity-0" : "opacity-100"}`}
      style={{ backgroundColor: cfg.overlayBg }}
      onClick={cfg.closeable ? close : undefined}
    >
      <div
        className={`relative w-[90vw] max-w-[340px] rounded-2xl p-6 flex flex-col items-center text-center transition-all duration-300 ${closing ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0 animate-[slideUpFade_0.3s_ease]"}`}
        style={{
          backgroundColor: modalBg,
          border: `1px solid ${borderColor}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {cfg.closeable && (
          <button
            onClick={close}
            className="absolute top-3 right-3 p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
            style={{ minHeight: 32, minWidth: 32, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <img src={logo} alt="Loreall Play TV" style={{ height: 40, width: "auto" }} className="mb-4" />

        <div className="mb-3">{cfg.icon}</div>

        <h2
          className="mb-2 leading-tight"
          style={{
            fontSize: cfg.titleSize,
            fontWeight: cfg.titleWeight,
            color: cfg.titleColor,
          }}
        >
          {cfg.getTitle(days)}
        </h2>

        <p className="text-sm mb-5" style={{ color: "#8888AA" }}>
          {cfg.subtitle}
        </p>

        <button
          onClick={handlePrimary}
          className="btn-primary-gradient w-full font-semibold text-sm py-3 mb-2"
          style={{ borderRadius: 12, minHeight: 48 }}
        >
          {cfg.primaryLabel}
        </button>

        <button
          onClick={handleSecondary}
          className="text-sm font-medium py-2 transition-colors"
          style={{ color: "#8888AA", minHeight: 40 }}
        >
          {cfg.secondaryLabel}
        </button>
      </div>

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
