import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, X, User, Phone } from "lucide-react";
import { updateCustomer, getCustomer } from "@/lib/api";
import { useAuthStore, Customer } from "@/store/authStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

const onlyDigits = (v: string) => v.replace(/\D/g, "");

const formatPhone = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const ProfileSheet = ({ open, onClose }: Props) => {
  const { customer, login } = useAuthStore();
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !customer) return;
    setName(customer.name || "");
    const raw =
      (customer as any).whatsapp ||
      (customer as any).celular ||
      "";
    setWhatsapp(formatPhone(String(raw)));
  }, [open, customer]);

  if (!open || !customer) return null;

  const handleSave = async () => {
    const trimmed = name.trim();
    const phoneDigits = onlyDigits(whatsapp);
    if (trimmed.length < 3) return toast.error("Informe seu nome completo.");
    if (phoneDigits.length < 10) return toast.error("WhatsApp inválido.");

    setSaving(true);
    try {
      await updateCustomer(customer.id, { name: trimmed, whatsapp: phoneDigits });
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
        className="bg-card w-full max-w-[480px] rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-200 relative"
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
          Mantenha suas informações atualizadas para receber cobranças e avisos.
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
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
              inputMode="tel"
              maxLength={16}
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm"
              placeholder="(00) 00000-0000"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Enviaremos avisos de vencimento e cobranças automáticas neste número.
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
