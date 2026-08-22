import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, X, User, Phone, Mail, IdCard } from "lucide-react";
import { updateCustomer, getCustomer } from "@/lib/api";
import { useAuthStore, Customer } from "@/store/authStore";
import { formatPhone, onlyDigits } from "@/utils/formatters";
import PhoneInput from "@/components/PhoneInput";
import { isValidPhone, splitPhone } from "@/utils/countries";

interface Props {
  open: boolean;
  onClose: () => void;
}




const formatCpf = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const ProfileSheet = ({ open, onClose }: Props) => {
  const { customer, login } = useAuthStore();
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !customer) return;
    setName(customer.name || "");
    const raw =
      (customer as any).whatsapp ||
      (customer as any).celular ||
      "";
    setWhatsapp(String(raw).replace(/\D/g, ""));
    setEmail(String((customer as any).email || ""));
    setCpf(formatCpf(String((customer as any).cpf || "")));
  }, [open, customer]);

  if (!open || !customer) return null;

  const handleSave = async () => {
    const trimmed = name.trim();
    const phoneDigits = onlyDigits(whatsapp);
    const cpfDigits = onlyDigits(cpf);
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmed.length < 3) return toast.error("Informe seu nome completo.");
    {
      const sp = splitPhone(whatsapp);
      if (!isValidPhone(sp.dial, sp.national)) return toast.error("WhatsApp inválido.");
    }
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))
      return toast.error("E-mail inválido.");
    if (cpfDigits && cpfDigits.length !== 11) return toast.error("CPF inválido.");

    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        name: trimmed,
        whatsapp: phoneDigits,
      };
      if (trimmedEmail) patch.email = trimmedEmail;
      if (cpfDigits) patch.cpf = cpfDigits;

      await updateCustomer(customer.id, patch);
      const data = await getCustomer(customer.id);
      login((data.data || data) as Customer);
      toast.success("Dados atualizados!");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar dados.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-[480px] rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-200 relative max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-2"
          style={{ minHeight: 44, minWidth: 44 }}
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-bold text-foreground mb-1">Meus dados</h3>
        <p className="text-xs text-muted-foreground mb-5">
          Preencha uma vez e reutilize no Pix Automático e nas cobranças.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <User className="h-3.5 w-3.5" /> Nome completo
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm"
              placeholder="Seu nome completo"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <Phone className="h-3.5 w-3.5" /> WhatsApp para cobranças
            </label>
            <PhoneInput value={whatsapp} onChange={setWhatsapp} />
          </div>

          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <Mail className="h-3.5 w-3.5" /> E-mail <span className="opacity-60">(opcional)</span>
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm"
              placeholder="voce@email.com"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <IdCard className="h-3.5 w-3.5" /> CPF <span className="opacity-60">(opcional)</span>
            </label>
            <input
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              inputMode="numeric"
              maxLength={14}
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm"
              placeholder="000.000.000-00"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Adiantar o CPF e e-mail agiliza a assinatura do Pix Automático.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary-gradient w-full mt-6 py-3.5 font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ minHeight: 48 }}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar alterações
        </button>
      </div>
    </div>
  );
};

export default ProfileSheet;
