import { AlertTriangle } from "lucide-react";

interface AlertsProps {
  days: number;
}

export const DashboardStatusAlerts = ({ days }: AlertsProps) => {
  if (days < 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl p-3.5 text-sm font-medium bg-destructive/10 text-destructive-foreground border border-destructive/20">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15">
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </div>
        <p className="leading-snug pt-1">Seu acesso está vencido. Renove para continuar assistindo.</p>
      </div>
    );
  }

  if (days === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl p-3.5 text-sm font-medium bg-warning/10 text-warning-foreground border border-warning/20">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/15">
          <AlertTriangle className="h-4 w-4 text-warning" />
        </div>
        <p className="leading-snug pt-1">Seu acesso vence hoje. Renove agora para não ficar sem sinal.</p>
      </div>
    );
  }

  if (days < 7) {
    return (
      <div className="flex items-start gap-3 rounded-xl p-3.5 text-sm font-medium bg-warning/10 text-warning-foreground border border-warning/20">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/15">
          <AlertTriangle className="h-4 w-4 text-warning" />
        </div>
        <p className="leading-snug pt-1">
          {days === 1 ? "Falta 1 dia" : `Faltam ${days} dias`} para o vencimento. Renove agora!
        </p>
      </div>
    );
  }

  return null;
};