import { User, Calendar, Package, ArrowLeft } from "lucide-react";
import { Customer } from "@/store/authStore";
import { LoginAccount } from "@/lib/api";
import { maskName, formatPhone } from "@/utils/formatters";
import { formatDate } from "@/lib/format";

interface AccountSelectionProps {
  matches: LoginAccount[];
  onPick: (account: LoginAccount) => void;
  onBack: () => void;
}

export const AccountSelection = ({ matches, onPick, onBack }: AccountSelectionProps) => {
  return (
    <>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </button>
      <h1 className="text-lg font-bold text-foreground text-center mb-1">
        Escolha um acesso
      </h1>
      <p className="text-xs text-muted-foreground text-center mb-5">
        Encontramos {matches.length} contas. Selecione qual deseja abrir:
      </p>
      <div className="space-y-2.5">
        {matches.map((account) => {
          const c = account.customer as unknown as Customer;
          const planName = (c.plan as any)?.name || (c as any).product?.name || "—";
          return (
            <button
              key={c.id}
              onClick={() => onPick(account)}
              className="w-full text-left p-3 rounded-lg border border-input bg-card hover:border-ring hover:bg-accent/40 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-foreground text-sm truncate">
                  {maskName(c.usuario || c.name)}
                </span>
                {c.status && (
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                    {c.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3" /> {planName}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {formatDate(c.data_de_vencimento)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
};
