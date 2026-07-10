import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { getPlans, updateCustomer, getCustomer } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useAuthStore, Customer } from "@/store/authStore";
import {
  Plan, getPlanName, getPlanValue,
  matchesScreenCount, hasAnyScreenTag, detectCurrentPeriod, matchesPeriod,
} from "@/lib/planUtils";

// Regra fixa: telas sempre = 1. O cliente só escolhe o plano (período).
const FIXED_TELAS = 1;

const MyPlanSection = () => {
  const { customer, login } = useAuthStore();
  const queryClient = useQueryClient();

  const [confirmModal, setConfirmModal] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    staleTime: 120_000,
    enabled: !!customer,
  });

  const currentPlanId = customer?.plan?.id;
  const currentPlanName = customer?.plan?.name || "";
  const currentPeriod = detectCurrentPeriod(currentPlanName);

  const allPlans: Plan[] = Array.isArray(plansQuery.data)
    ? plansQuery.data
    : plansQuery.data?.data || [];

  const filteredPlans = useMemo(() => {
    if (!currentPeriod) return [];
    return allPlans.filter((p) => {
      const name = getPlanName(p);
      return hasAnyScreenTag(name) &&
        matchesPeriod(name, currentPeriod) &&
        matchesScreenCount(name, FIXED_TELAS);
    });
  }, [allPlans, currentPeriod]);

  if (!customer) return null;

  const handlePlanClick = (plan: Plan) => {
    if (plan.id === currentPlanId) return;
    setConfirmModal(plan);
  };

  const handleConfirm = async () => {
    if (!confirmModal) return;
    setSaving(true);
    try {
      // NUNCA enviar `telas` — o número de telas é gerenciado no TopGestor
      // e deve permanecer o que o admin configurou lá (padrão: 1).
      await updateCustomer(customer.id, { plan_id: confirmModal.id });
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
    <>
      <p className="text-sm text-muted-foreground mb-4">
        Escolha o plano para o mesmo período do seu plano atual.
      </p>

      {/* Plans for same period */}
      {plansQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : !currentPeriod ? (
        <p className="text-sm text-muted-foreground">Não foi possível detectar o período do plano atual.</p>
      ) : filteredPlans.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {filteredPlans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            return (
              <button
                key={plan.id}
                onClick={() => handlePlanClick(plan)}
                className={`relative p-4 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  isCurrent ? "cursor-default" : "card-elevated cursor-pointer"
                }`}
                style={
                  isCurrent
                    ? {
                        border: "2px solid transparent",
                        background:
                          "linear-gradient(white,white) padding-box, linear-gradient(135deg,#00C8FF,#7B2FD4) border-box",
                        borderRadius: 16,
                      }
                    : { minHeight: 44 }
                }
              >
                {isCurrent && (
                  <span className="absolute top-2.5 right-2.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-pill btn-primary-gradient">
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

      {/* Confirmation modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
          <div className="card-elevated p-6 w-full max-w-sm relative animate-in fade-in zoom-in-95">
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
                className="btn-primary-gradient px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60 flex-1"
                style={{ minHeight: 44 }}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar
              </button>
              <button
                onClick={() => setConfirmModal(null)}
                className="px-5 py-2.5 text-sm rounded-lg transition-all flex-1"
                style={{ minHeight: 44, border: "1.5px solid hsl(var(--secondary))", color: "hsl(var(--secondary))" }}
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

export default MyPlanSection;
