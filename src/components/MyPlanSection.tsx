import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { getPlans, updateCustomer, getCustomer } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useAuthStore, Customer } from "@/store/authStore";
import {
  Plan, getPlanName, getPlanValue, screenLabel,
  matchesScreenCount, hasAnyScreenTag, detectCurrentPeriod, matchesPeriod,
} from "@/lib/planUtils";

const SCREEN_OPTIONS = [1, 2, 3] as const;

const MyPlanSection = () => {
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

  if (!customer) return null;

  const currentPlanId = customer.plan?.id;
  const currentPlanName = customer.plan?.name || "";
  const currentPeriod = detectCurrentPeriod(currentPlanName);

  const allPlans: Plan[] = Array.isArray(plansQuery.data)
    ? plansQuery.data
    : plansQuery.data?.data || [];

  // Show plans matching the same period as current plan, for each screen count
  const filteredPlans = useMemo(() => {
    if (!currentPeriod) return [];
    return allPlans.filter((p) => {
      const name = getPlanName(p);
      return hasAnyScreenTag(name) &&
        matchesPeriod(name, currentPeriod) &&
        matchesScreenCount(name, selectedScreens);
    });
  }, [allPlans, currentPeriod, selectedScreens]);

  const handlePlanClick = (plan: Plan) => {
    if (plan.id === currentPlanId) return;
    setConfirmModal(plan);
  };

  const handleConfirm = async () => {
    if (!confirmModal) return;
    setSaving(true);
    try {
      await updateCustomer(customer.id, { plan_id: confirmModal.id, telas: selectedScreens });
      const data = await getCustomer(customer.id);
      login((data.data || data) as Customer);
      queryClient.invalidateQueries({ queryKey: ["invoices", customer.id] });
      toast.success("Plano atualizado! Sua renovação já reflete o novo valor.");
      setConfirmModal(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-elevated p-6">
      <h2 className="text-lg font-bold text-foreground mb-2">Adicionar ou remover telas</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Escolha a quantidade de telas para o mesmo período do seu plano atual.
      </p>

      {/* Screen toggle */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {SCREEN_OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => setSelectedScreens(n)}
            className={`py-3 rounded-lg text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] ${
              selectedScreens === n
                ? "btn-primary-gradient"
                : "bg-card border border-border text-muted-foreground hover:border-secondary"
            }`}
          >
            {screenLabel(n)}
          </button>
        ))}
      </div>

      {/* Plans for same period */}
      {plansQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : !currentPeriod ? (
        <p className="text-sm text-muted-foreground">Não foi possível detectar o período do plano atual.</p>
      ) : filteredPlans.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredPlans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            return (
              <button
                key={plan.id}
                onClick={() => handlePlanClick(plan)}
                className={`relative p-5 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  isCurrent ? "cursor-default" : "card-elevated hover:shadow-md cursor-pointer"
                }`}
                style={
                  isCurrent
                    ? {
                        border: "2px solid transparent",
                        background:
                          "linear-gradient(white,white) padding-box, linear-gradient(135deg,#00C8FF,#7B2FD4) border-box",
                        borderRadius: "16px",
                      }
                    : undefined
                }
              >
                {isCurrent && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-pill btn-primary-gradient">
                    Plano atual
                  </span>
                )}
                <p className="font-bold text-foreground text-base mb-1">{getPlanName(plan)}</p>
                <p className="text-lg font-bold gradient-primary-text">
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

      {/* Confirmation modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
          <div className="card-elevated p-6 w-full max-w-md relative animate-in fade-in zoom-in-95">
            <button onClick={() => setConfirmModal(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
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
                className="btn-primary-gradient px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar
              </button>
              <button
                onClick={() => setConfirmModal(null)}
                className="px-5 py-2.5 text-sm border-[1.5px] border-secondary text-secondary rounded-lg hover:bg-secondary/5 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPlanSection;
