import { useState, useMemo, useEffect } from "react";
import QRCode from "qrcode";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ExternalLink, Copy, Check, X, QrCode, Zap, Repeat, Sparkles, ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { getPlans, getCustomer, renewCustomer, createPixPayment, CreatePixResponse, updateCustomer, authHeaders } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { maskDoc, isValidDoc, onlyDigits as onlyDigitsDoc, detectDoc } from "@/lib/doc";
import { useAuthStore, Customer } from "@/store/authStore";
import {
  Plan, getPlanName, getPlanValue, computeRenewalCards,
  mapProviderToServidor, buildCardsFromAreaPricing, AreaPricingPlan,
  extractTelasFromPlanName, isLegacyPlanName,
} from "@/lib/planUtils";
import { WHATSAPP_NUMBER } from "@/utils/constants";
const logo = "/logo.png";

interface SyncpayPublicPlan {
  id: string;
  syncpay_plan_id: string;
  name: string;
  amount: number;
  periodicity_days: number;
  billing_method: string;
  checkout_url: string | null;
  topgestor_plan_id: number | null;
}

interface SubscribeResult {
  subscription_id?: string;
  subscription_status?: string;
  billing_method?: "qr_code" | "pix_automatico" | string;
  qr_code_text?: string | null;
  qr_code_base64?: string | null;
  mandate_id?: string | null;
  mandate_status?: string | null;
  amount?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const PIX_MAX_AMOUNT = 500; // Limite máximo por transação PIX

const RenewalBottomSheet = ({ open, onClose }: Props) => {
  const { customer, login } = useAuthStore();
  const queryClient = useQueryClient();

  // Telas derivada do nome do plano atual — evita depender do campo bruto do TopGestor.
  const currentTelas = extractTelasFromPlanName(customer?.plan?.name) || 1;

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [pix, setPix] = useState<CreatePixResponse | null>(null);
  const [pixStatus, setPixStatus] = useState<string>("pending");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  // fallback (planos >= R$500)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  // Assinatura recorrente
  const [subForm, setSubForm] = useState<SyncpayPublicPlan | null>(null);
  const [subName, setSubName] = useState("");
  const [subEmail, setSubEmail] = useState("");
  const [subCpf, setSubCpf] = useState("");
  const [subPhone, setSubPhone] = useState("");
  const [subLoading, setSubLoading] = useState(false);
  const [subResult, setSubResult] = useState<SubscribeResult | null>(null);
  const [checkingSub, setCheckingSub] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrDataUrl2, setQrDataUrl2] = useState<string | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Gera QR Code localmente para a tela de Assinatura
  useEffect(() => {
    if (!subResult?.qr_code_text) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(subResult.qr_code_text, { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [subResult?.qr_code_text]);

  // Gera QR Code localmente para a tela de Pix direto
  useEffect(() => {
    if (!pix?.qr_code_text) {
      setQrDataUrl2(null);
      return;
    }
    QRCode.toDataURL(pix.qr_code_text, { width: 220, margin: 1 })
      .then(setQrDataUrl2)
      .catch(() => setQrDataUrl2(null));
  }, [pix?.qr_code_text]);


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
        .select("id, syncpay_plan_id, name, amount, periodicity_days, billing_method, checkout_url, topgestor_plan_id")
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

  const servidor = mapProviderToServidor((customer as any)?.iptv_provider);

  const areaPricingQuery = useQuery({
    queryKey: ["area-pricing", servidor, currentTelas],
    queryFn: async (): Promise<AreaPricingPlan[]> => {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/area-pricing?servidor=${servidor}&telas=${currentTelas}`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!res.ok) return [];
      const data = await res.json().catch(() => ({}));
      return Array.isArray(data?.plans) ? data.plans : [];
    },
    staleTime: 120_000,
    enabled: !!customer && open && !!servidor && !isLegacyPlanName(customer?.plan?.name),
  });

  const currentPlanId =
    (customer?.plan?.id as number | undefined) ??
    (customer?.plan_id as number | undefined);

  // Evita "flash" de preços antigos: enquanto a tabela por servidor está carregando,
  // não mostramos os cards legados (que gerariam PIX com valor/plano errado).
  const pricingLoading =
    plansQuery.isLoading || (!!servidor && areaPricingQuery.isLoading);

  const periodCards = useMemo(() => {
    if (!isLegacyPlanName(customer?.plan?.name)) {
      const areaCards = buildCardsFromAreaPricing(areaPricingQuery.data || []);
      if (areaCards.length > 0) return areaCards;
    }
    return computeRenewalCards(allPlans, currentPlanId, currentTelas);
  }, [areaPricingQuery.data, allPlans, currentPlanId, currentTelas, customer?.plan?.name]);

  const activeCard = periodCards[selectedIdx] || periodCards[0];
  const selectedPlan = activeCard?.plan;
  const planValue = selectedPlan ? getPlanValue(selectedPlan) : 0;
  // Sincroniza o valor exibido com o valor real do plano na API
  const canUsePix = planValue > 0 && planValue < PIX_MAX_AMOUNT;

  // Escolhe UM plano de assinatura recomendado (preferindo PIX Automático)
  // filtrado pelo plano TopGestor atual do cliente. Mantém a UI simples.
  const recommendedSubPlan = useMemo<SyncpayPublicPlan | null>(() => {
    const all = subPlansQuery.data || [];
    if (all.length === 0) return null;
    
    // 1. Tentar encontrar plano recorrente que mapeia para o ID do plano atual do TopGestor
    if (currentPlanId) {
      const matched = all.filter((sp) => Number(sp.topgestor_plan_id) === Number(currentPlanId));
      if (matched.length > 0) {
        return matched.find((sp) => sp.billing_method === "pix_automatico") || matched[0];
      }

      // 2. Fallback: procurar por nome ou periodicidade se o ID não bater
      const currentPlan = allPlans.find(p => p.id === currentPlanId);
      if (currentPlan) {
        const name = getPlanName(currentPlan).toLowerCase();
        const fallback = all.find(sp => 
          name.includes(sp.name.toLowerCase()) || 
          (sp.periodicity_days > 0 && name.includes(sp.periodicity_days + " dias"))
        );
        if (fallback) return fallback;
      }
    }
    
    // 3. Se nada bater, mostrar o plano recorrente mais barato como sugestão
    return all[0];
  }, [subPlansQuery.data, currentPlanId, allPlans]);

  const openSubscribeForm = async (sp: SyncpayPublicPlan) => {
    if (!customer) return;
    setSubForm(sp);
    setSubResult(null);
    setCheckingSub(true);

    try {
      // 1. Verificar se o cliente já tem uma assinatura deste plano ativa no nosso banco
      const { data: existingSub, error } = await supabase
        .from("syncpay_subscriptions")
        .select("*")
        .eq("customer_id", customer.id)
        .eq("syncpay_plan_id", sp.syncpay_plan_id)
        .maybeSingle();

      if (existingSub) {
        // Se existe, consulta o status real na SyncPay
        const { data: statusData, error: statusError } = await supabase.functions.invoke("syncpay-subscription-status", {
          body: { subscription_id: existingSub.syncpay_subscription_id },
          headers: {
            "x-customer-token": useAuthStore.getState().token || "",
          }
        });

        if (!statusError && statusData) {
          const res = statusData as { status: string; mandate_status?: string; raw?: any };
          const sub = res.raw || {};
          const payment = sub.payment || sub.charge || sub.first_charge || {};

          setSubResult({
            subscription_id: existingSub.syncpay_subscription_id,
            subscription_status: res.status,
            mandate_id: payment.mandate_id || sub.mandate_id,
            mandate_status: res.mandate_status,
            qr_code_text: payment.qr_code || payment.pix_code || sub.pix_code,
            qr_code_base64: payment.qr_code_base64 || sub.qr_code_base64,
            billing_method: sp.billing_method
          });

          // Se estiver ativa, já avisa
          if (res.status === "active" || res.mandate_status?.toUpperCase() === "ACTIVE") {
            toast.success("Você já possui uma assinatura ativa para este plano!");
          }
          setCheckingSub(false);
          return;
        }
      }
    } catch (e) {
      console.error("[openSubscribeForm] erro ao checar assinatura existente", e);
    }

    setSubName(customer?.name || "");
    setSubEmail(((customer as any)?.email as string) || "");
    setSubCpf(maskDoc(String((customer as any)?.cpf || "")));
    setSubPhone(
      String(((customer as any)?.whatsapp as string) || ((customer as any)?.celular as string) || "")
    );
    setCheckingSub(false);
  };

  const closeSubscribeForm = () => {
    setSubForm(null);
    setSubResult(null);
    setSubLoading(false);
    setCheckingSub(false);
  };

  const handleSubscribe = async () => {
    if (!subForm || !customer) return;
    setSubLoading(true);
    try {
      const cleanCpf = onlyDigitsDoc(subCpf);
      let cleanPhone = subPhone.replace(/\D/g, "");
      if (cleanPhone.length > 11 && cleanPhone.startsWith("55")) {
        cleanPhone = cleanPhone.slice(2);
      }
      const trimmedName = subName.trim();
      const trimmedEmail = subEmail.trim().toLowerCase();

      if (!isValidDoc(cleanCpf)) {
        setSubLoading(false);
        toast.error("CPF ou CNPJ inválido. Confira os dígitos.");
        return;
      }

      // Persiste dados no TopGestor para reutilizar em próximas assinaturas
      try {
        const savedName = (customer.name || "").trim();
        const savedEmail = String((customer as any).email || "").trim().toLowerCase();
        const savedCpf = String((customer as any).cpf || "").replace(/\D/g, "");
        const savedPhone = String((customer as any).whatsapp || (customer as any).celular || "").replace(/\D/g, "");
        const patch: Record<string, unknown> = {};
        if (trimmedName && trimmedName !== savedName) patch.name = trimmedName;
        if (trimmedEmail && trimmedEmail !== savedEmail) patch.email = trimmedEmail;
        if (cleanCpf && cleanCpf !== savedCpf) patch.cpf = cleanCpf;
        if (cleanPhone && cleanPhone !== savedPhone) patch.whatsapp = cleanPhone;
        if (Object.keys(patch).length > 0) {
          await updateCustomer(customer.id, patch);
          try {
            const cust = await getCustomer(customer.id);
            login((cust.data || cust) as Customer);
          } catch { /* ignore refresh error */ }
        }
      } catch (e) {
        console.warn("[subscribe] falha ao salvar dados do cliente", e);
      }

      const { data, error } = await supabase.functions.invoke("syncpay-subscribe", {
        body: {
          plan_id: subForm.id,
          customer_id: customer.id,
          name: trimmedName,
          email: trimmedEmail,
          cpf: cleanCpf,
          phone: cleanPhone,
        },
        headers: {
          "x-customer-token": useAuthStore.getState().token || "",
        }
      });
      if (error) {
        const detail = await error.context?.json().catch(() => null);
        throw new Error(detail?.error || error.message || "Falha ao criar assinatura");
      }
      const res = data as SubscribeResult & { error?: string };
      if (!res.qr_code_text) {
        throw new Error("Resposta sem QR Code");
      }
      setSubResult(res);
      toast.success(subForm.billing_method === "pix_automatico"
        ? "Solicitação criada. Autorize no aplicativo do seu banco."
        : "Assinatura criada. Pague o PIX para ativar.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar assinatura");
    } finally {
      setSubLoading(false);
    }
  };


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
          headers: authHeaders(),
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
          headers: authHeaders(),
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

  // Polling para status da assinatura SyncPay (Pix Automático)
  useEffect(() => {
    if (!subResult?.subscription_id || subResult.subscription_status === "active") return;
    
    let stop = false;
    const checkStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("syncpay-subscription-status", {
          body: { 
            subscription_id: subResult.subscription_id,
            customer_id: customer?.id 
          },
          headers: {
            "x-customer-token": useAuthStore.getState().token || "",
          }
        });
        
        if (stop || error) return;
        
        const res = data as { status: string; mandate_status?: string };
        const isAuthorized = res.status === "active" || 
                           res.mandate_status?.toUpperCase() === "ACTIVE";

        if (isAuthorized) {
          setSubResult(prev => prev ? { ...prev, subscription_status: "active", mandate_status: "active" } : null);
          stop = true;
          toast.success("Pix Automático ativado com sucesso!");
          
          // Refresh customer and invalidate queries to update dashboard
          queryClient.invalidateQueries({ queryKey: ["active-subscription", customer?.id] });
          try {
            const cust = await getCustomer(customer!.id);
            login((cust.data || cust) as Customer);
          } catch (e) {
            console.error("refresh customer failed", e);
          }
        }
      } catch (e) {
        console.error("[syncpay-subscription-status poll]", e);
      }
    };

    const interval = setInterval(checkStatus, 5000);
    return () => {
      stop = true;
      clearInterval(interval);
    };
  }, [subResult?.subscription_id, subResult?.subscription_status, customer, login]);


  if (!customer) return null;

  const resetState = () => {
    setPix(null);
    setPaymentUrl(null);
    setPixStatus("pending");
    setCopied(false);
  };

  const handleClose = () => {
    setSubResult(null); // Limpa polling da assinatura
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

  // ---------- Tela: assinatura recorrente (form ou QR) ----------
  if (subForm) {
    const isPixAuto = subForm.billing_method === "pix_automatico";
    const qrText = subResult?.qr_code_text;

    const qrImg = qrDataUrl;
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={closeSubscribeForm}>
        <div
          className="bg-card w-full max-w-[480px] md:max-w-2xl md:rounded-2xl rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-200 max-h-[95vh] overflow-y-auto relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={closeSubscribeForm} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-2" style={{ minHeight: 44, minWidth: 44 }}>
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            {isPixAuto ? <Zap className="h-4 w-4 text-primary" /> : <Repeat className="h-4 w-4 text-muted-foreground" />}
            <h3 className="text-lg font-bold text-foreground">{isPixAuto ? "Pix Automático" : "Assinatura recorrente"}</h3>
            {isPixAuto && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">RECOMENDADO</span>}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            {subForm.name} · {formatCurrency(Number(subForm.amount))} / {subForm.periodicity_days}d
          </p>

          {checkingSub ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground animate-pulse">Verificando sua assinatura...</p>
            </div>
          ) : !subResult ? (
            <>
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 space-y-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Nome completo</label>
                    <input value={subName} onChange={(e) => setSubName(e.target.value)} className="w-full mt-0.5 px-2.5 py-2 rounded-md bg-background border border-border text-sm" placeholder="Como no CPF" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">WhatsApp</label>
                    <input value={subPhone} onChange={(e) => setSubPhone(e.target.value)} inputMode="tel" className="w-full mt-0.5 px-2.5 py-2 rounded-md bg-background border border-border text-sm" placeholder="(00) 00000-0000" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Salvos no seu perfil — só preencha se estiverem em branco.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">
                    CPF ou CNPJ <span className="text-destructive">*</span>
                  </label>
                  <input
                    value={subCpf}
                    onChange={(e) => setSubCpf(maskDoc(e.target.value))}
                    inputMode="numeric"
                    maxLength={18}
                    className={`w-full mt-1 px-3 py-2.5 rounded-lg bg-background border text-sm ${
                      subCpf && !isValidDoc(subCpf) ? "border-destructive" : "border-border"
                    }`}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  />
                  {subCpf && !isValidDoc(subCpf) && (
                    <p className="text-[10px] text-destructive mt-1">
                      {detectDoc(subCpf) ? "Documento inválido — confira os dígitos." : "Digite os 11 dígitos do CPF ou 14 do CNPJ."}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">E-mail <span className="text-destructive">*</span></label>
                  <input value={subEmail} onChange={(e) => setSubEmail(e.target.value)} type="email" className="w-full mt-1 px-3 py-2.5 rounded-lg bg-background border border-border text-sm" placeholder="voce@email.com" />
                </div>
              </div>
              <button
                onClick={handleSubscribe}
                disabled={subLoading}
                className="btn-primary-gradient w-full mt-5 py-3.5 font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ minHeight: 48 }}
              >
                {subLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Assinar e gerar Pix
              </button>
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Salvamos seus dados para as próximas assinaturas. Ao continuar você autoriza a cobrança automática.
              </p>
            </>
          ) : (
            <>
              {subResult.subscription_status === "active" ? (
                <div className="py-12 flex flex-col items-center gap-4 text-center animate-in zoom-in-95 duration-300">
                  <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-foreground">Pix Automático ativo!</h4>
                    <p className="text-sm text-muted-foreground mt-2 max-w-[280px]">
                      Sua assinatura foi autorizada no banco e já está ativa em nosso sistema.
                    </p>
                  </div>
                  <button onClick={closeSubscribeForm} className="btn-primary-gradient px-8 py-3 rounded-xl font-bold text-sm mt-4">
                    Voltar ao Início
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-center text-[20px] font-bold text-foreground mb-1">{formatCurrency(Number(subResult.amount || subForm.amount))}</p>
                  <p className="text-center text-xs text-muted-foreground mb-3">
                    {isPixAuto
                      ? "Escaneie o QR Code no aplicativo do seu banco para autorizar o Pix Automático."
                      : "Pagamento pendente. Pague o PIX para ativar sua assinatura."}
                  </p>

                  {qrImg && (
                    <div className="flex justify-center mb-4">
                      <div className="bg-white p-3 rounded-xl">
                        <img src={qrImg} alt="QR Code PIX" style={{ width: 220, height: 220 }} />
                      </div>
                    </div>
                  )}

                  {qrText && (
                    <>
                      <p className="text-xs text-muted-foreground mb-1.5">{isPixAuto ? "Código para autorização:" : "Código copia e cola:"}</p>
                      <div className="bg-muted rounded-lg p-2.5 mb-3">
                        <p className="text-[11px] text-foreground break-all font-mono">{qrText}</p>
                      </div>
                      <button
                        onClick={() => handleCopy(qrText)}
                        className="w-full px-5 py-3 text-sm rounded-lg inline-flex items-center justify-center gap-1.5 transition-all mb-2"
                        style={{ minHeight: 48, border: "1.5px solid hsl(var(--secondary))", color: "hsl(var(--secondary))" }}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copiado!" : isPixAuto ? "Copiar código de autorização" : "Copiar código PIX"}
                    </button>
                    <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 mb-2">
                      <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-700 leading-relaxed">
                        🔒 Cobrança oficial Loreall Play. Se seu banco alertar sobre possível golpe, fica tranquilo — é comum em pagamento pra empresa, pode confirmar normalmente.{" "}
                        <a
                          href={`https://wa.me/${WHATSAPP_NUMBER}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold underline hover:text-amber-800"
                        >
                          Não conseguiu pagar por aqui? Fala com a gente.
                        </a>
                      </p>
                    </div>
                  </>
                  )}

                  {isPixAuto && <p className="text-[11px] text-muted-foreground text-center mt-2">Status: aguardando autorização do Pix Automático.</p>}

                  <button onClick={closeSubscribeForm} className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2 w-full" style={{ minHeight: 44 }}>
                    Fechar
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  }



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
          className="bg-card w-full max-w-[480px] md:max-w-2xl md:rounded-2xl rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-200 max-h-[95vh] overflow-y-auto relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => (isPaid ? handleClose() : setShowExitConfirm(true))}
            className="absolute top-4 right-4 bg-muted/60 hover:bg-muted text-foreground rounded-full p-2 z-10"
            style={{ minHeight: 44, minWidth: 44 }}
          >
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
              <p className="text-sm text-muted-foreground mb-3">Seu acesso já foi renovado.</p>
              <div className="text-left text-[13px] text-muted-foreground bg-muted/40 border border-border/60 rounded-xl p-3 mb-5">
                <p className="font-semibold text-foreground mb-1">Ainda não liberou no aplicativo?</p>
                <p>Feche o aplicativo por completo e entre novamente para atualizar. Se precisar, aguarde 1 minutinho ou desligue o aparelho da tomada por 2 minutos e ligue de novo.</p>
              </div>

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

              {qrDataUrl2 && (
                <div className="flex justify-center mb-4">
                  <div className="bg-white p-3 rounded-xl">
                    <img src={qrDataUrl2} alt="QR Code PIX" style={{ width: 220, height: 220 }} />
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
                    <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 mb-2">
                      <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-700 leading-relaxed">
                        🔒 Cobrança oficial Loreall Play. Se seu banco alertar sobre possível golpe, fica tranquilo — é comum em pagamento pra empresa, pode confirmar normalmente.{" "}
                        <a
                          href={`https://wa.me/${WHATSAPP_NUMBER}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold underline hover:text-amber-800"
                        >
                          Não conseguiu pagar por aqui? Fala com a gente.
                        </a>
                      </p>
                    </div>
                  </>
              )}

              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground justify-center">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Aguardando pagamento...
              </div>
            </>
          )}

          <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
            <AlertDialogContent className="w-[90%] max-w-[380px] rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Falta pouco pra renovar!</AlertDialogTitle>
                <AlertDialogDescription>
                  Você já gerou o Pix. O que prefere fazer?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col gap-2 mt-2">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm text-white"
                  style={{ background: "linear-gradient(90deg,#3b82f6,#8b5cf6)" }}
                >
                  Continuar pagamento
                </button>
                <button
                  onClick={() => { setShowExitConfirm(false); resetState(); }}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm border border-border text-foreground"
                >
                  Trocar de plano
                </button>
                <button
                  onClick={() => { setShowExitConfirm(false); handleClose(); }}
                  className="w-full py-2 text-xs text-muted-foreground underline"
                >
                  Cancelar e sair
                </button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  // ---------- Tela: link TopGestor (fallback ≥ R$500) ----------
  if (paymentUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={handleClose}>
        <div
          className="bg-card w-full max-w-[480px] md:max-w-2xl md:rounded-2xl rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-200"
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
        className="bg-card w-full max-w-[480px] md:max-w-2xl md:rounded-2xl rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-foreground">Renovar acesso</h3>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground p-2" style={{ minHeight: 44, minWidth: 44 }}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Valores do seu plano atual</p>

        {pricingLoading ? (
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

            {/* PIX Automático — card único destacado */}
            {recommendedSubPlan && (
              <div className="mt-5 pt-5 border-t border-border">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Pagamento automático
                </p>
                <button
                  onClick={() => openSubscribeForm(recommendedSubPlan)}
                  className="w-full text-left block p-4 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden"
                  style={{
                    border: "2px solid transparent",
                    background:
                      "linear-gradient(hsl(var(--card)), hsl(var(--card))) padding-box, linear-gradient(135deg, #00C8FF, #7B2FD4) border-box",
                    borderRadius: 16,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-full p-2 bg-primary/10 shrink-0">
                      <Zap className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="text-sm font-bold text-foreground">
                          {recommendedSubPlan.billing_method === "pix_automatico"
                            ? "PIX Automático"
                            : "Assinatura recorrente"}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">
                          RECOMENDADO
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Nunca mais se preocupe com renovação. Autorize uma vez no app do banco e pronto.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            )}

          </>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground font-medium">
              Nenhum plano de renovação encontrado para sua conta.
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-2">
              Isso pode ocorrer se seu plano atual for personalizado. Entre em contato com o suporte para renovar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RenewalBottomSheet;
