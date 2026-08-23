import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { Megaphone, X } from "lucide-react";

interface Notice {
  ativo: boolean;
  mensagem: string;
  atualizado_em: string;
}

const NoticeBanner = () => {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/referrals-api?action=get-site-notice`, {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        "x-customer-token": useAuthStore.getState().token || "",
      },
    })
      .then((r) => r.json())
      .then((parsed: Notice) => {
        if (parsed.ativo && parsed.mensagem) {
          const already = sessionStorage.getItem("aviso_dismissed");
          if (already === parsed.atualizado_em) setDismissed(true);
          setNotice(parsed);
        }
      })
      .catch(() => {});
  }, []);

  if (!notice || !notice.ativo || dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem("aviso_dismissed", notice.atualizado_em);
    setDismissed(true);
  };

  return (
    <div className="w-full border-b notice-banner">
      <div className="flex items-center gap-2.5 px-4 py-2.5 w-full max-w-[480px] md:max-w-4xl mx-auto">
        <Megaphone className="h-5 w-5 shrink-0" />
        <p className="text-[12px] sm:text-sm font-medium flex-1">{notice.mensagem}</p>
        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-lg hover:opacity-80 transition-opacity shrink-0"
          style={{ minHeight: 40, minWidth: 40, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default NoticeBanner;