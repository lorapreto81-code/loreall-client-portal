import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { requestOtp, verifyOtp, LoginAccount } from "@/lib/api";
import { useAuthStore, Customer } from "@/store/authStore";
import { onlyDigits } from "@/utils/formatters";
import { REF_KEY, EMAIL_RE } from "@/utils/constants";

export const useLoginFlow = () => {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [resendIn, setResendIn] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [matches, setMatches] = useState<LoginAccount[]>([]);
  const [targetHint, setTargetHint] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      const c = ref.trim().toUpperCase();
      localStorage.setItem(REF_KEY, c);
      navigate(`/indicacao/${c}`, { replace: true });
      return;
    }
    const stored = localStorage.getItem(REF_KEY);
    if (stored) setRefCode(stored);
  }, [navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const pickAccount = (account: LoginAccount) => {
    const c = account.customer as unknown as Customer;
    login(c, account.token);
    toast.success("Bem-vindo, " + c.name + "!");
    navigate("/welcome");
  };

  const sendCode = async () => {
    const isEmail = EMAIL_RE.test(phone) || /^[a-zA-Z0-9_\-\.]+(@[a-zA-Z0-9_\-\.]+)?$/.test(phone);
    const digits = onlyDigits(phone).slice(0, 13);
    
    if (!isEmail && digits.length < 10) {
      toast.error("Informe seu WhatsApp com DDD ou um E-mail válido.");
      return;
    }
    
    const identifier = isEmail ? phone.toLowerCase().trim() : digits;
    setLoading(true);
    try {
      const res = await requestOtp(identifier);
      if (res.target_hint) {
        setTargetHint(res.target_hint);
        setCustomerName(res.customer_name || null);
        const welcome = res.customer_name ? `Olá, ${res.customer_name}! ` : "";
        toast.success(`${welcome}Código enviado no WhatsApp de final ${res.target_hint}`);
      } else {
        toast.success(res.message || "Código enviado no seu WhatsApp.");
      }
      setStep("code");
      setResendIn(60);
    } catch (err: any) {
      toast.error(err.message || "Não foi possível enviar o código.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === "phone") {
      await sendCode();
      return;
    }
    const c = onlyDigits(code);
    if (c.length !== 6) {
      toast.error("Digite o código de 6 dígitos.");
      return;
    }
    setLoading(true);
    try {
      const identifier = (EMAIL_RE.test(phone) || /^[a-zA-Z0-9_\-\.]+(@[a-zA-Z0-9_\-\.]+)?$/.test(phone)) ? phone : onlyDigits(phone).slice(0, 13);
      const { accounts } = await verifyOtp(identifier, c);
      if (!accounts || accounts.length === 0) {
        toast.error("Conta não encontrada.");
        return;
      }
      if (accounts.length === 1) {
        pickAccount(accounts[0]);
        return;
      }
      setMatches(accounts);
    } catch (err: any) {
      toast.error(err.message || "Código inválido.");
    } finally {
      setLoading(false);
    }
  };

  return {
    phone,
    setPhone,
    code,
    setCode,
    step,
    setStep,
    resendIn,
    loading,
    refCode,
    matches,
    setMatches,
    targetHint,
    customerName,
    pickAccount,
    sendCode,
    handleSubmit
  };
};