import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { getPlans, updateCustomer, getCustomer } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useAuthStore, Customer } from "@/store/authStore";
import {
  Plan, getPlanName, getPlanValue, screenLabel,
  matchesScreenCount, hasAnyScreenTag,
} from "@/lib/planUtils";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SCREEN_OPTIONS = [1, 2, 3] as const;

const ChangePlanBottomSheet = ({ open, onClose }: Props) => {
  const { customer, login } = useAuthStore();
  const queryClient = useQueryClient();

  const currentTelas = typeof customer?.telas === "number"
    ? customer.telas
    : parseInt(String(customer?.telas || "1"), 10) || 1;

  const [selectedScreens, setSelectedScreens] = useState(currentTelas);
  const [confirmModal, setConfirmModal] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    staleTime: 120_000,
    enabled: !!customer,
  });

  const currentPlanId = customer?.plan?.id;

  const allPlans: Plan[] = Array.isArray(plansQuery.data)
    ? plansQuery.data
    : plansQuery.data?.data || [];

  const filteredPlans = useMemo(() => {
    return allPlans.filter((p) => {
      const name = getPlanName(p);
      return hasAnyScreenTag(name) && matchesScreenCount(name, selectedScreens);
    });
  }, [allPlans, selectedScreens]);

  if (!open || !customer) return null;

  const handlePlanClick = (plan: Plan) => {
    if (plan.id === currentPlanId) return;
    setConfirmModal(plan);
  };

  const handleConfirm = async () => {
    if (!confirmModal) return;
    setSaving(true);
    try {
      await updateCustomer(customer.id, { plan_id: confirmModal.id });
      const data = await getCustomer(customer.id);
      login((data.data || data) as Customer);
      queryClient.invalidateQueries({ queryKey: ["invoices", customer.id] });
      toast.success("Plano atualizado com sucesso!");
      setConfirmModal(null);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar.");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setConfirmModal(null);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={handleClose}>
        <div
          className="bg-card w-full max-w-[480px] rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-200"
          style={{ borderTop: "1px solid hsl(var(--border))" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold text-foreground">Trocar plano</h3>
            <button onClick={handleClose} className="text-muted-foreground hover:text-foreground p-2" style={{ minHeight: 44, minWidth: 44 }}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Escolha a quantidade de telas e o plano desejado.</p>

          {/* Screen toggle */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {SCREEN_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setSelectedScreens(n)}
                className={`py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  selectedScreens === n
                    ? "btn-primary-gradient"
                    : "bg-muted border border-border text-muted-foreground"
                }`}
                style={{ minHeight: 44 }}
              >
                {screenLabel(n)}
              </button>
            ))}
          </div>

          {/* Plans grid */}
          {plansQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : filteredPlans.length > 0 ? (
            <div className="grid grid-cols-2 gap-3" style={{ maxHeight: 300, overflowY: "auto" }}>
              {filteredPlans.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                return (
                  <button
                    key={plan.id}
                    onClick={() => handlePlanClick(plan)}
                    className={`relative p-4 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                      isCurrent ? "cursor-default" : "bg-card border border-border cursor-pointer"
                    }`}
                    style={
                      isCurrent
                        ? {
                            border: "2px solid transparent",
                            background: "linear-gradient(hsl(var(--card)),hsl(var(--card))) padding-box, linear-gradient(135deg,#00C8FF,#7B2FD4) border-box",
                            borderRadius: 16,
                          }
                        : { borderRadius: 16 }
                    }
                  >
                    {isCurrent && (
                      <span className="absolute top-2.5 right-2.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full btn-primary-gradient">
                        Atual
                      </span>
                    )}
                    <p className="font-bold text-foreground text-sm mb-1">{getPlanName(plan)}</p>
                    <p className="text-base font-bold gradient-primary-text">
                      {formatCurrency(getPlanValue(plan))}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum plano disponível para {screenLabel(selectedScreens).toLowerCase()}.
            </p>
          )}
        </div>
      </div>

      {/* Confirmation modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm relative animate-in fade-in zoom-in-95 border border-border">
            <button onClick={() => setConfirmModal(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-2">
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-foreground mb-2">Trocar de plano</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Deseja trocar para{" "}
              <span className="font-semibold text-foreground">{getPlanName(confirmModal)}</span> por{" "}
              <span className="font-semibold text-foreground">{formatCurrency(getPlanValue(confirmModal))}</span>?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="btn-primary-gradient px-5 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 flex-1"
                style={{ minHeight: 44 }}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar
              </button>
              <button
                onClick={() => setConfirmModal(null)}
                className="px-5 py-2.5 text-sm rounded-lg transition-all flex-1 bg-muted border border-secondary text-secondary"
                style={{ minHeight: 44 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChangePlanBottomSheet;
