import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { Megaphone } from "lucide-react";
import { BannerCloseButton } from "@/components/BannerCloseButton";

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
    <div className="w-full max-w-[480px] md:max-w-4xl mx-auto px-4 pt-4">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg animate-in fade-in slide-in-from-top-2">
        <div className="h-1 w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500" />
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Aviso importante</p>
            <p className="mt-1 text-sm text-card-foreground whitespace-pre-line break-words">{notice.mensagem}</p>
          </div>
          <BannerCloseButton onClick={handleDismiss} label="Fechar aviso" />
        </div>
      </div>
    </div>
  );
};

export default NoticeBanner;