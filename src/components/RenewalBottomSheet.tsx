import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ExternalLink, Copy, Check, X } from "lucide-react";
import { getPlans, updateCustomer, getCustomer, generatePaymentLink } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useAuthStore, Customer } from "@/store/authStore";
import {
  Plan, PERIOD_MAP, getPlanName, getPlanValue,
  matchesScreenCount, hasAnyScreenTag, matchesPeriod,
} from "@/lib/planUtils";
import logo from "@/assets/loreall-logo.png";

interface Props {
  open: boolean;
  onClose: () => void;
}

const RenewalBottomSheet = ({ open, onClose }: Props) => {
  const { customer, login } = useAuthStore();
  const queryClient = useQueryClient();

  const currentTelas = typeof customer?.telas === "number"
    ? customer.telas
    : parseInt(String(customer?.telas || "1"), 10) || 1;

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
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

  const periodCards = useMemo(() => {
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

  const activeCard = periodCards[selectedIdx] || periodCards[0];
  const selectedPlan = activeCard?.plan;

  if (!customer) return null;

  const handleGenerate = async () => {
    if (!selectedPlan) return;
    setGeneratingLink(true);
    try {
      await updateCustomer(customer.id, { plan_id: selectedPlan.id });
      const data = await generatePaymentLink(customer.id);
      const url = data.checkout_url || data.data?.checkout_url;
      if (url) {
        const custData = await getCustomer(customer.id);
        login((custData.data || custData) as Customer);
        queryClient.invalidateQueries({ queryKey: ["invoices", customer.id] });
        setPaymentUrl(url);
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

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleClose = () => {
    setPaymentUrl(null);
    onClose();
  };

  if (!open) return null;

  // Success modal with payment URL
  if (paymentUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={handleClose}>
        <div
          className="bg-card w-full max-w-[480px] rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={handleClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-2" style={{ minHeight: 44, minWidth: 44 }}>
            <X className="h-5 w-5" />
          </button>
          <div className="flex justify-center mb-4">
            <img src={logo} alt="Loreall Play TV" style={{ width: 60, height: "auto" }} />
          </div>
          <h3 className="text-lg font-bold text-foreground text-center mb-1">Sua fatura está pronta!</h3>
          {selectedPlan && (
            <p className="text-center text-sm text-muted-foreground mb-5">
              Valor: <span className="font-semibold text-foreground">{formatCurrency(getPlanValue(selectedPlan))}</span>
            </p>
          )}
          <div className="flex flex-col gap-2.5">
            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary-gradient px-5 py-3 text-sm font-semibold inline-flex items-center justify-center gap-1.5"
              style={{ minHeight: 48 }}
            >
              <ExternalLink className="h-4 w-4" /> Pagar agora
            </a>
            <button
              onClick={() => handleCopy(paymentUrl)}
              className="px-5 py-3 text-sm rounded-lg inline-flex items-center justify-center gap-1.5 transition-all"
              style={{ minHeight: 48, border: "1.5px solid hsl(var(--secondary))", color: "hsl(var(--secondary))" }}
            >
              {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedLink ? "Copiado!" : "Copiar link"}
            </button>
            <button onClick={handleClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2" style={{ minHeight: 44 }}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="bg-card w-full max-w-[480px] rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-foreground">Renovar acesso</h3>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground p-2" style={{ minHeight: 44, minWidth: 44 }}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Valores do seu plano atual</p>

        {plansQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : periodCards.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {periodCards.map((card, idx) => {
                const isSelected = idx === (selectedIdx < periodCards.length ? selectedIdx : 0);
                return (
                  <button
                    key={card.months}
                    onClick={() => setSelectedIdx(idx)}
                    className={`p-4 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                      isSelected ? "" : "bg-card border border-border"
                    }`}
                    style={
                      isSelected
                        ? {
                            border: "2px solid transparent",
                            background: "linear-gradient(hsl(var(--card)), hsl(var(--card))) padding-box, linear-gradient(135deg, #00C8FF, #7B2FD4) border-box",
                            borderRadius: 16,
                            backgroundColor: "rgba(123, 47, 212, 0.04)",
                          }
                        : { borderRadius: 16 }
                    }
                  >
                    <p className="text-sm font-medium text-muted-foreground mb-1">{card.label}</p>
                    <p className="text-lg font-bold text-foreground">
                      {card.plan ? formatCurrency(getPlanValue(card.plan)) : "—"}
                    </p>
                  </button>
                );
              })}
            </div>

            {selectedPlan && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-xl font-bold text-foreground">{formatCurrency(getPlanValue(selectedPlan))}</span>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generatingLink}
                  className="btn-primary-gradient w-full py-3.5 font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ minHeight: 48 }}
                >
                  {generatingLink && <Loader2 className="h-4 w-4 animate-spin" />}
                  Gerar fatura
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
    </div>
  );
};

export default RenewalBottomSheet;
