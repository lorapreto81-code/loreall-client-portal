import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ExternalLink, Copy, Check, X, QrCode, Zap, Repeat, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPlans, getCustomer, renewCustomer, createPixPayment, CreatePixResponse } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useAuthStore, Customer } from "@/store/authStore";
import {
  Plan, getPlanName, getPlanValue, computeRenewalCards,
} from "@/lib/planUtils";
const logo = "/logo.png";

interface SyncpayPublicPlan {
  id: string;
  syncpay_plan_id: string;
  name: string;
  amount: number;
  periodicity_days: number;
  billing_method: string;
  checkout_url: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const PIX_MAX_AMOUNT = 500; // Fast Depix exige CPF para >= R$ 500

const RenewalBottomSheet = ({ open, onClose }: Props) => {
  const { customer, login } = useAuthStore();
  const queryClient = useQueryClient();

  // Telas é regra fixa do sistema: sempre 1. Não usamos mais o valor do TopGestor.
  const currentTelas = 1;

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [pix, setPix] = useState<CreatePixResponse | null>(null);
  const [pixStatus, setPixStatus] = useState<string>("pending");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  // fallback (planos >= R$500)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    staleTime: 120_000,
    enabled: !!customer && open,
  });

  // Planos de assinatura ativos (SyncPay) — leitura pública via RLS
  const subPlansQuery = useQuery({
    queryKey: ["syncpay-public-plans"],
    queryFn: async (): Promise<SyncpayPublicPlan[]> => {
      const { data, error } = await supabase
        .from("syncpay_plans" as any)
        .select("id, syncpay_plan_id, name, amount, periodicity_days, billing_method, checkout_url")
        .eq("status", "active")
        .order("amount", { ascending: true });
      if (error) return [];
      return (data as unknown as SyncpayPublicPlan[]) || [];
    },
    staleTime: 300_000,
    enabled: !!customer && open,
  });

  const allPlans: Plan[] = Array.isArray(plansQuery.data)
    ? plansQuery.data
    : plansQuery.data?.data || [];

  const currentPlanId =
    (customer?.plan?.id as number | undefined) ??
    (customer?.plan_id as number | undefined);

  const periodCards = useMemo(
    () => computeRenewalCards(allPlans, currentPlanId, currentTelas),
    [allPlans, currentPlanId, currentTelas],
  );

  const activeCard = periodCards[selectedIdx] || periodCards[0];
  const selectedPlan = activeCard?.plan;
  const planValue = selectedPlan ? getPlanValue(selectedPlan) : 0;
  const canUsePix = planValue > 0 && planValue < PIX_MAX_AMOUNT;

  // Tick para countdown
  useEffect(() => {
    if (!pix) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pix]);

  // Retomar PIX pendente ao abrir (via edge function — RLS bloqueia leitura direta)
  useEffect(() => {
    if (!open || !customer || pix) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("payment-status", {
          body: { action: "pending", customer_id: customer.id },
        });
        if (cancelled || error) return;
        const p = (data as { payment?: { id: string; amount: number; qr_code_url: string | null; qr_code_text: string | null; qr_code_expires_at: string; fastdepix_status: string } })?.payment;
        if (!p || !p.qr_code_text) return;
        setPix({
          payment_id: p.id,
          qr_code_url: p.qr_code_url || "",
          qr_code_text: p.qr_code_text || "",
          expires_at: p.qr_code_expires_at,
          amount: Number(p.amount),
        });
        setPixStatus(p.fastdepix_status || "pending");
      } catch (e) {
        if (!cancelled) console.error("[payment-status pending]", e);
      }
    })();
    return () => { cancelled = true; };
  }, [open, customer, pix]);

  // Polling: verifica status do pagamento a cada 3s
  useEffect(() => {
    if (!pix?.payment_id || !customer) return;
    let stop = false;
    const tick = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("payment-status", {
          body: { action: "status", payment_id: pix.payment_id, customer_id: customer.id },
        });
        if (stop || error) return;
        const newStatus = (data as { fastdepix_status?: string })?.fastdepix_status;
        if (!newStatus) return;
        setPixStatus(newStatus);
        if (newStatus === "paid") {
          stop = true;
          toast.success("Pagamento confirmado! Renovando seu acesso...");
          localStorage.removeItem("loreall_pending_ref");
          try {
            const cust = await getCustomer(customer.id);
            login((cust.data || cust) as Customer);
          } catch (e) {
            console.error("refresh customer failed", e);
          }
          queryClient.invalidateQueries({ queryKey: ["invoices", customer.id] });
        }
      } catch (e) {
        if (!stop) console.error("[payment-status poll]", e);
      }
    };
    tick();
    const interval = setInterval(tick, 3000);
    return () => {
      stop = true;
      clearInterval(interval);
    };
  }, [pix?.payment_id, customer, login, queryClient]);


  if (!customer) return null;

  const resetState = () => {
    setPix(null);
    setPaymentUrl(null);
    setPixStatus("pending");
    setCopied(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleGeneratePix = async () => {
    if (!selectedPlan) return;
    setGenerating(true);
    try {
      const refCode = localStorage.getItem("loreall_pending_ref") || undefined;
      const data = await createPixPayment({
        customer_id: customer.id,
        customer_name: customer.name,
        customer_whatsapp: String((customer as any).whatsapp || (customer as any).celular || ""),
        plan_id: selectedPlan.id,
        plan_name: getPlanName(selectedPlan),
        amount: getPlanValue(selectedPlan),
        referral_code: refCode,
      });
      setPix(data);
      setPixStatus("pending");
      toast.success("QR Code PIX gerado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar PIX.");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!selectedPlan) return;
    setGenerating(true);
    try {
      const data = await renewCustomer(customer.id, { plan_id: selectedPlan.id });
      const url =
        data.data?.checkout_url ||
        data.checkout_url ||
        data.data?.invoice?.checkout_url;
      if (url) {
        const cust = await getCustomer(customer.id);
        login((cust.data || cust) as Customer);
        queryClient.invalidateQueries({ queryKey: ["invoices", customer.id] });
        setPaymentUrl(url);
        toast.success("Fatura gerada com sucesso!");
      } else {
        toast.error("Não foi possível obter o link de pagamento.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar fatura.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  // ---------- Tela: PIX gerado ----------
  if (pix) {
    const expiresMs = new Date(pix.expires_at).getTime() - now;
    const expired = expiresMs <= 0;
    const minutes = Math.max(0, Math.floor(expiresMs / 60000));
    const seconds = Math.max(0, Math.floor((expiresMs % 60000) / 1000));
    const isPaid = pixStatus === "paid";

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={handleClose}>
        <div
          className="bg-card w-full max-w-[480px] rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-200 max-h-[95vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={handleClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-2" style={{ minHeight: 44, minWidth: 44 }}>
            <X className="h-5 w-5" />
          </button>
          <div className="flex justify-center mb-3">
            <img src={logo} alt="Loreall Play TV" style={{ width: 56, height: "auto" }} />
          </div>

          {isPaid ? (
            <div className="text-center py-6">
              <div className="mx-auto mb-3 inline-flex items-center justify-center rounded-full p-3" style={{ background: "rgba(93, 202, 165, 0.15)" }}>
                <Check className="h-8 w-8" style={{ color: "#5DCAA5" }} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-1">Pagamento confirmado!</h3>
              <p className="text-sm text-muted-foreground mb-5">Seu acesso já foi renovado.</p>
              <button onClick={handleClose} className="btn-primary-gradient w-full py-3 font-semibold text-sm" style={{ minHeight: 48 }}>
                Concluir
              </button>
            </div>
          ) : (
            <>
              <h3 className="text-base font-bold text-foreground text-center mb-1">Pague com PIX</h3>
              <p className="text-center text-[20px] font-bold text-foreground mb-1">{formatCurrency(pix.amount)}</p>
              <p className="text-center text-xs text-muted-foreground mb-3">
                {expired ? "QR Code expirado" : `Expira em ${minutes}:${String(seconds).padStart(2, "0")}`}
              </p>

              {pix.qr_code_url && (
                <div className="flex justify-center mb-4">
                  <div className="bg-white p-3 rounded-xl">
                    <img src={pix.qr_code_url} alt="QR Code PIX" style={{ width: 220, height: 220 }} />
                  </div>
                </div>
              )}

              {pix.qr_code_text && (
                <>
                  <p className="text-xs text-muted-foreground mb-1.5">Código copia e cola:</p>
                  <div className="bg-muted rounded-lg p-2.5 mb-3">
                    <p className="text-[11px] text-foreground break-all font-mono">{pix.qr_code_text}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(pix.qr_code_text)}
                    className="w-full px-5 py-3 text-sm rounded-lg inline-flex items-center justify-center gap-1.5 transition-all mb-2"
                    style={{ minHeight: 48, border: "1.5px solid hsl(var(--secondary))", color: "hsl(var(--secondary))" }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copiado!" : "Copiar código PIX"}
                  </button>
                </>
              )}

              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground justify-center">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Aguardando pagamento...
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------- Tela: link TopGestor (fallback ≥ R$500) ----------
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
            <p className="text-center mb-5">
              <span className="text-[20px] font-bold text-foreground">{formatCurrency(getPlanValue(selectedPlan))}</span>
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
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado!" : "Copiar link"}
            </button>
            <button onClick={handleClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2" style={{ minHeight: 44 }}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Tela: seleção de plano ----------
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
                  <span className="text-xl font-bold text-foreground">{formatCurrency(planValue)}</span>
                </div>

                {canUsePix ? (
                  <button
                    onClick={handleGeneratePix}
                    disabled={generating}
                    className="btn-primary-gradient w-full py-3.5 font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ minHeight: 48 }}
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                    Pagar com PIX
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleGenerateLink}
                      disabled={generating}
                      className="btn-primary-gradient w-full py-3.5 font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
                      style={{ minHeight: 48 }}
                    >
                      {generating && <Loader2 className="h-4 w-4 animate-spin" />}
                      Gerar fatura
                    </button>
                    <p className="text-[11px] text-muted-foreground text-center mt-2">
                      PIX instantâneo disponível para valores abaixo de {formatCurrency(PIX_MAX_AMOUNT)}.
                    </p>
                  </>
                )}
              </>
            )}

            {/* Assinaturas SyncPay — opção recorrente */}
            {subPlansQuery.data && subPlansQuery.data.length > 0 && (
              <div className="mt-5 pt-5 border-t border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-bold text-foreground">Nunca mais se preocupe com renovação</h4>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">Assine e o pagamento acontece sozinho todo mês.</p>
                <div className="space-y-2">
                  {subPlansQuery.data.map((sp) => {
                    const isPixAuto = sp.billing_method === "pix_automatico";
                    const url = sp.checkout_url
                      ? `${sp.checkout_url}${sp.checkout_url.includes("?") ? "&" : "?"}customer_id=${customer.id}&name=${encodeURIComponent(customer.name)}&email=${encodeURIComponent((customer as any).email || "")}`
                      : null;
                    return (
                      <a
                        key={sp.id}
                        href={url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => { if (!url) e.preventDefault(); }}
                        className={`block p-3 rounded-xl border-2 transition-all hover:scale-[1.01] ${isPixAuto ? "border-primary bg-primary/5" : "border-input bg-card hover:border-muted-foreground/40"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isPixAuto ? <Zap className="h-3.5 w-3.5 text-primary" /> : <Repeat className="h-3.5 w-3.5 text-muted-foreground" />}
                              <span className="text-sm font-semibold text-foreground truncate">{sp.name}</span>
                              {isPixAuto && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">RECOMENDADO</span>}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {isPixAuto ? "Débito automático · autoriza 1x no app do banco" : "QR novo por e-mail a cada ciclo"}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-base font-bold text-foreground">{formatCurrency(Number(sp.amount))}</div>
                            <div className="text-[10px] text-muted-foreground">/ {sp.periodicity_days}d</div>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
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
