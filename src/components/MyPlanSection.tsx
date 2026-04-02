import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Check, Copy, ExternalLink, X } from "lucide-react";
import { getPlans, updateCustomer, getCustomer, generatePaymentLink } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useAuthStore, Customer } from "@/store/authStore";
import logo from "@/assets/loreall-logo.png";

interface Plan {
  id: number;
  plan_name?: string;
  name?: string;
  plan_value?: number | string;
  value?: number | string;
}

const SCREEN_OPTIONS = [1, 2, 3] as const;

const screenLabel = (n: number) => (n === 1 ? "1 Tela" : `${n} Telas`);

const matchesScreenCount = (planName: string, count: number): boolean => {
  const lower = planName.toLowerCase();
  if (count === 1) return lower.includes("1 tela") && !lower.includes("1 telas");
  return lower.includes(`${count} telas`);
};

const hasAnyScreenTag = (planName: string): boolean =>
  /[123]\s*telas?/i.test(planName);

const MyPlanSection = () => {
  const { customer, login } = useAuthStore();
  const queryClient = useQueryClient();

  const currentTelas = typeof customer?.telas === "number"
    ? customer.telas
    : parseInt(String(customer?.telas || "1"), 10) || 1;

  const [selectedScreens, setSelectedScreens] = useState(currentTelas);
  const [confirmModal, setConfirmModal] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [showInvoiceBanner, setShowInvoiceBanner] = useState(false);
  const [paymentModal, setPaymentModal] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    staleTime: 120_000,
    enabled: !!customer,
  });

  if (!customer) return null;

  const currentPlanId = customer.plan?.id;
  const allPlans: Plan[] = Array.isArray(plansQuery.data)
    ? plansQuery.data
    : plansQuery.data?.data || [];

  const filteredPlans = useMemo(
    () => allPlans.filter((p) => {
      const name = p.plan_name || p.name || "";
      return hasAnyScreenTag(name) && matchesScreenCount(name, selectedScreens);
    }),
    [allPlans, selectedScreens]
  );

  const getPlanName = (p: Plan) => p.plan_name || p.name || "Plano";
  const getPlanValue = (p: Plan) => {
    const v = p.plan_value ?? p.value;
    return typeof v === "string" ? parseFloat(v) : (v || 0);
  };

  const refreshCustomer = async () => {
    try {
      const data = await getCustomer(customer.id);
      const updated = data.data || data;
      login(updated as Customer);
      queryClient.invalidateQueries({ queryKey: ["invoices", customer.id] });
    } catch { /* silent */ }
  };

  const handlePlanClick = (plan: Plan) => {
    if (plan.id === currentPlanId && selectedScreens === currentTelas) return;
    setConfirmModal(plan);
  };

  const handleConfirm = async () => {
    if (!confirmModal) return;
    setSaving(true);
    try {
      if (confirmModal.id !== currentPlanId) {
        await updateCustomer(customer.id, { plan_id: confirmModal.id });
      }
      if (selectedScreens !== currentTelas) {
        await updateCustomer(customer.id, { telas: selectedScreens });
      }
      await refreshCustomer();
      toast.success("Plano atualizado com sucesso!");
      setConfirmModal(null);
      setShowInvoiceBanner(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar.");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateInvoice = async () => {
    setGeneratingLink(true);
    try {
      const data = await generatePaymentLink(customer.id);
      const url = data.checkout_url || data.data?.checkout_url;
      if (url) {
        setPaymentModal(url);
        setShowInvoiceBanner(false);
        toast.success("Fatura gerada com sucesso!");
      } else {
        toast.error("Não foi possível gerar o link de pagamento.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar fatura.");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const currentPlanValue = typeof customer.plan?.value === "string"
    ? parseFloat(customer.plan.value)
    : (customer.plan?.value || 0);

  return (
    <div className="space-y-6">
      <div className="card-elevated p-6">
        <h2 className="text-lg font-bold text-foreground mb-4">Meu Plano</h2>

        {/* STEP 1 — Screen count */}
        <p className="text-sm font-medium text-muted-foreground mb-2">Quantas telas?</p>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {SCREEN_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setSelectedScreens(n)}
              className={`py-3 rounded-lg text-sm font-semibold transition-all ${
                selectedScreens === n
                  ? "btn-primary-gradient"
                  : "bg-card border border-border text-muted-foreground hover:border-secondary"
              }`}
            >
              {screenLabel(n)}
            </button>
          ))}
        </div>

        {/* STEP 2 — Plans for selected screen count */}
        <p className="text-sm font-medium text-muted-foreground mb-2">Escolha o período</p>

        {plansQuery.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : plansQuery.isError ? (
          <p className="text-sm text-destructive">Erro ao carregar planos.</p>
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
                    <span className="text-xs font-normal text-muted-foreground">/mês</span>
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum plano disponível para {screenLabel(selectedScreens).toLowerCase()}.</p>
        )}
      </div>

      {/* Invoice banner */}
      {showInvoiceBanner && (
        <div className="card-elevated p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">
            Deseja gerar uma fatura de renovação com o novo plano?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleGenerateInvoice}
              disabled={generatingLink}
              className="btn-primary-gradient px-4 py-2 text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {generatingLink && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Gerar fatura
            </button>
            <button
              onClick={() => setShowInvoiceBanner(false)}
              className="px-4 py-2 text-sm border-[1.5px] border-secondary text-secondary rounded-lg hover:bg-secondary/5 transition-all"
            >
              Agora não
            </button>
          </div>
        </div>
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
              <span className="font-semibold text-foreground">{formatCurrency(getPlanValue(confirmModal))}/mês</span>?
              {selectedScreens !== currentTelas && (
                <> E atualizar para <span className="font-semibold text-foreground">{selectedScreens} tela(s)</span>?</>
              )}
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

      {/* Payment modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
          <div className="card-elevated p-6 w-full max-w-md relative animate-in fade-in zoom-in-95">
            <button onClick={() => setPaymentModal(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
            <div className="flex justify-center mb-4">
              <img src={logo} alt="Loreall Play TV" style={{ width: 80, height: "auto" }} />
            </div>
            <h3 className="text-lg font-bold text-foreground text-center mb-1">Sua fatura está pronta!</h3>
            <p className="text-center text-sm text-muted-foreground mb-4">
              Plano atual: <span className="font-semibold text-foreground">{formatCurrency(currentPlanValue)}/mês</span>
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={paymentModal}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary-gradient px-5 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="h-4 w-4" /> Pagar agora
              </a>
              <button
                onClick={() => handleCopyLink(paymentModal)}
                className="px-5 py-2.5 text-sm border-[1.5px] border-secondary text-secondary rounded-lg hover:bg-secondary/5 inline-flex items-center justify-center gap-1.5 transition-all"
              >
                {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedLink ? "Copiado!" : "Copiar link"}
              </button>
              <button onClick={() => setPaymentModal(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPlanSection;
