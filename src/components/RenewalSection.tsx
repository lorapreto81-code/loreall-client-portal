import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ExternalLink, Copy, Check, X } from "lucide-react";
import { getPlans, getCustomer, renewCustomer } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useAuthStore, Customer } from "@/store/authStore";
import {
  Plan, PERIOD_MAP, getPlanName, getPlanValue,
  matchesScreenCount, hasAnyScreenTag, matchesPeriod,
} from "@/lib/planUtils";
const logo = "/logo.png";

const RenewalSection = () => {
  const { customer, login } = useAuthStore();
  const queryClient = useQueryClient();

  const currentTelas = typeof customer?.telas === "number"
    ? customer.telas
    : parseInt(String(customer?.telas || "1"), 10) || 1;

  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [paymentModal, setPaymentModal] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    staleTime: 120_000,
    enabled: !!customer,
  });

  const allPlans: Plan[] = Array.isArray(plansQuery.data)
    ? plansQuery.data
    : plansQuery.data?.data || [];

  const availableTabs = useMemo(() => {
    return PERIOD_MAP.map((period) => {
      const plan = allPlans.find((p) => {
        const name = getPlanName(p);
        return hasAnyScreenTag(name) &&
          matchesScreenCount(name, currentTelas) &&
          matchesPeriod(name, period.keyword);
      });
      return { ...period, plan };
    }).filter((t) => t.plan != null);
  }, [allPlans, currentTelas]);

  const activeTab = availableTabs[selectedPeriodIdx] || availableTabs[0];
  const selectedPlan = activeTab?.plan;

  if (!customer) return null;

  const handleGenerate = async () => {
    if (!selectedPlan) return;
    setGeneratingLink(true);
    try {
      const data = await renewCustomer(customer.id, { plan_id: selectedPlan.id });
      const url =
        data.data?.checkout_url ||
        data.checkout_url ||
        data.data?.invoice?.checkout_url;
      if (url) {
        const custData = await getCustomer(customer.id);
        login((custData.data || custData) as Customer);
        queryClient.invalidateQueries({ queryKey: ["invoices", customer.id] });
        setPaymentModal(url);
        toast.success("Renovação gerada com sucesso!");
      } else {
        toast.error("Não foi possível obter o link de pagamento.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar renovação.");
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

  return (
    <>
      <div className="card-elevated p-6">
        <h2 className="text-lg font-bold text-foreground mb-4">Renovar acesso</h2>

        {plansQuery.isLoading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : plansQuery.isError ? (
          <p className="text-sm text-destructive">Erro ao carregar planos.</p>
        ) : availableTabs.length > 0 ? (
          <>
            {/* Period tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {availableTabs.map((tab, idx) => (
                <button
                  key={tab.months}
                  onClick={() => setSelectedPeriodIdx(idx)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    idx === (selectedPeriodIdx < availableTabs.length ? selectedPeriodIdx : 0)
                      ? "btn-primary-gradient"
                      : "border-[1.5px] border-secondary text-secondary hover:bg-secondary/5"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Selected plan value */}
            {selectedPlan && (
              <>
                <p className="text-sm text-muted-foreground mb-1">
                  {getPlanName(selectedPlan)}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Total:{" "}
                  <span className="font-bold text-foreground text-lg">
                    {formatCurrency(getPlanValue(selectedPlan))}
                  </span>
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={generatingLink}
                  className="btn-primary-gradient px-6 py-3 font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-60 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {generatingLink && <Loader2 className="h-4 w-4 animate-spin" />}
                  Gerar fatura de renovação
                </button>
              </>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum plano disponível para {currentTelas} tela(s).
          </p>
        )}
      </div>

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
            {selectedPlan && (
              <p className="text-center text-sm text-muted-foreground mb-4">
                Valor: <span className="font-semibold text-foreground">{formatCurrency(getPlanValue(selectedPlan))}</span>
              </p>
            )}
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
    </>
  );
};

export default RenewalSection;
