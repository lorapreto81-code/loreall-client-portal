import { AlertTriangle, ChevronRight, Clock, Lock } from "lucide-react";
import type { JourneyStep } from "../hooks/useCustomerJourney";
import promoAsset from "@/assets/promo-15.png.asset.json";

interface BannersProps {
  step: JourneyStep;
  days: number;
  hasValidPhone: boolean;
  promoPercent: number;
  onOpenAccount: (tab: "dados" | "faturas") => void;
  onRenew: () => void;
  onSnoozeProfile: () => void;
}

/** Renders ONLY the single highest-priority highlight chosen by useCustomerJourney. */
export const DashboardBanners = ({
  step, days, hasValidPhone, promoPercent, onOpenAccount, onRenew, onSnoozeProfile,
}: BannersProps) => {
  if (step === "expired" || step === "expiring") {
    const expired = step === "expired";
    const color = expired ? "var(--destructive)" : "var(--warning)";
    return (
      <div
        className="w-full rounded-xl p-4 border-2 animate-in fade-in slide-in-from-top duration-300 md:col-span-2"
        style={{ borderColor: `hsl(${color})`, background: `hsl(${color} / 0.08)` }}
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full p-2.5 shrink-0" style={{ background: `hsl(${color} / 0.18)` }}>
            {expired ? <Lock className="h-4 w-4" style={{ color: `hsl(${color})` }} /> : <Clock className="h-4 w-4" style={{ color: `hsl(${color})` }} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {expired ? "Seu acesso precisa ser renovado" : days === 0 ? "Seu acesso vence hoje" : `Seu acesso vence em ${days} dia${days === 1 ? "" : "s"}`}
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {expired ? "Seu acesso está vencido. Renove pelo PIX e a liberação é automática." : "Renove agora e continue assistindo sem interrupção."}
              {promoPercent > 0 && ` Sua 1ª renovação aqui tem ${promoPercent}% OFF.`}
            </p>
          </div>
        </div>
        <button onClick={onRenew} className="btn-primary-gradient w-full mt-3 py-3 rounded-xl font-bold text-sm" style={{ minHeight: 46 }}>
          {expired ? "RENOVAR ACESSO" : "RENOVAR AGORA"}
        </button>
      </div>
    );
  }

  if (step === "profile") {
    return (
      <div
        className="w-full rounded-xl p-4 border-2 animate-in fade-in slide-in-from-top duration-300 md:col-span-2"
        style={{ borderColor: "hsl(var(--primary) / 0.45)", background: "hsl(var(--primary) / 0.06)" }}
      >
        <button onClick={() => onOpenAccount("dados")} className="w-full text-left flex items-center gap-3">
          <div className="rounded-full p-2.5 shrink-0 bg-primary/15">
            <AlertTriangle className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Complete seus dados</p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {!hasValidPhone
                ? "Adicione seu WhatsApp com DDD para receber lembretes de renovação."
                : "Cadastre seu e-mail para receber lembretes antes do vencimento, com link para renovar em 1 clique."}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
        <div className="flex gap-2 mt-3">
          <button onClick={() => onOpenAccount("dados")} className="btn-primary-gradient flex-1 py-2.5 rounded-xl font-semibold text-sm">Atualizar agora</button>
          <button onClick={onSnoozeProfile} className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground">Agora não</button>
        </div>
      </div>
    );
  }

  if (step === "promo") {
    return (
      <button
        onClick={onRenew}
        className="w-full rounded-2xl overflow-hidden border border-primary/30 shadow-lg shadow-primary/10 transition-transform hover:scale-[1.01] active:scale-[0.99] md:col-span-2 animate-in fade-in duration-300 text-left"
        aria-label={`${promoPercent}% de desconto na primeira renovação`}
      >
        <img src={promoAsset.url} alt={`${promoPercent}% de desconto na primeira renovação pela área do cliente`} className="w-full h-auto block max-h-[360px] object-cover object-center" loading="lazy" />
        <div className="p-3 flex items-center justify-between gap-2 bg-card">
          <p className="text-xs text-muted-foreground">Válido 1 única vez, em todos os planos.</p>
          <span className="text-xs font-bold text-primary whitespace-nowrap">Aproveitar →</span>
        </div>
      </button>
    );
  }

  return null;
};
