import { AlertTriangle, ChevronRight, Mail, X } from "lucide-react";

interface BannersProps {
  profileIncomplete: boolean;
  hasValidPhone: boolean;
  showEmailBanner: boolean;
  onOpenAccount: (tab: "dados" | "faturas") => void;
  onDismissEmailBanner: () => void;
}

export const DashboardBanners = ({
  profileIncomplete,
  hasValidPhone,
  showEmailBanner,
  onOpenAccount,
  onDismissEmailBanner
}: BannersProps) => (
  <>
    {profileIncomplete && (
      <button
        onClick={() => onOpenAccount("dados")}
        className="w-full text-left rounded-xl p-4 flex items-center gap-3 border-2 animate-in fade-in slide-in-from-top duration-300"
        style={{ borderColor: "hsl(var(--warning))", background: "hsl(var(--warning) / 0.08)" }}
      >
        <div className="rounded-full p-2.5 shrink-0" style={{ background: "hsl(var(--warning) / 0.18)" }}>
          <AlertTriangle className="h-4 w-4" style={{ color: "hsl(var(--warning))" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Confirme seus dados</p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {!hasValidPhone
              ? "Adicione seu WhatsApp com DDD para receber lembretes de renovação."
              : "Verifique se seu nome está completo."}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
    )}

    {showEmailBanner && (
      <div
        className="w-full rounded-xl p-3.5 flex items-center gap-3 border animate-in fade-in slide-in-from-top duration-300 relative"
        style={{ borderColor: "hsl(var(--primary) / 0.35)", background: "hsl(var(--primary) / 0.06)" }}
      >
        <div className="rounded-full p-2 shrink-0 bg-primary/15">
          <Mail className="h-4 w-4 text-primary" />
        </div>
        <button onClick={() => onOpenAccount("dados")} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-semibold text-foreground">Cadastre seu e-mail oficial</p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Em breve o login será por e-mail. Adicione agora e não perca o acesso.
          </p>
        </button>
        <button
          onClick={onDismissEmailBanner}
          className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          style={{ minHeight: 32, minWidth: 32 }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )}
  </>
);