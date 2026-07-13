import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  X, User, Phone, Mail, Loader2, Receipt,
  CheckCircle2, Clock, XCircle, HelpCircle, Plus,
} from "lucide-react";
import { updateCustomer, getCustomer } from "@/lib/api";
import { useAuthStore, Customer } from "@/store/authStore";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Props {
  open: boolean;
  onClose: () => void;
  customerId: number;
  initialTab?: "dados" | "faturas";
  customerUsuario?: string;
  whatsappNumber?: string;
}

interface Invoice {
  id: string;
  amount: number;
  plan_name: string;
  provider: string;
  fastdepix_status: string;
  paid_at: string | null;
  created_at: string;
  renewed_at: string | null;
}

const onlyDigits = (v: string) => v.replace(/\D/g, "");
const formatPhone = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const formatCpf = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

function fmtBRL(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
const statusInfo = (s: string) => {
  const st = (s || "").toLowerCase();
  if (["paid", "approved", "completed"].includes(st))
    return { label: "Pago", color: "hsl(var(--success, 142 71% 45%))", bg: "hsl(142 71% 45% / 0.12)", Icon: CheckCircle2 };
  if (["pending"].includes(st))
    return { label: "Pendente", color: "#B47700", bg: "rgba(250,199,117,0.20)", Icon: Clock };
  return { label: "Expirado", color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted))", Icon: XCircle };
};

export default function MyAccountSheet({ open, onClose, customerId, initialTab = "dados", customerUsuario = "", whatsappNumber = "" }: Props) {
  const { customer, login } = useAuthStore();
  const [tab, setTab] = useState<"dados" | "faturas">(initialTab);

  // Dados
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [saving, setSaving] = useState(false);

  // Faturas
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open || !customer) return;
    setName(customer.name || "");
    const raw = (customer as any).whatsapp || (customer as any).celular || "";
    setWhatsapp(formatPhone(String(raw)));
    setEmail(String((customer as any).email || ""));
    setCpf(formatCpf(String((customer as any).cpf || "")));
  }, [open, customer]);

  useEffect(() => {
    if (!open || tab !== "faturas") return;
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/payment-status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({ action: "history", customer_id: customerId, limit: 30 }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
        if (!cancel) setItems(data.payments || []);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "Erro");
      }
      if (!cancel) setLoading(false);
    })();
    return () => { cancel = true; };
  }, [open, tab, customerId]);

  if (!open || !customer) return null;

  const handleSave = async () => {
    const trimmed = name.trim();
    const phoneDigits = onlyDigits(whatsapp);
    const cpfDigits = onlyDigits(cpf);
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmed.length < 3) return toast.error("Informe seu nome completo.");
    if (phoneDigits.length < 10) return toast.error("WhatsApp inválido.");
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))
      return toast.error("E-mail inválido.");
    if (cpfDigits && cpfDigits.length !== 11) return toast.error("CPF inválido.");

    setSaving(true);
    try {
      const patch: Record<string, unknown> = { name: trimmed, whatsapp: phoneDigits };
      if (trimmedEmail) patch.email = trimmedEmail;
      if (cpfDigits) patch.cpf = cpfDigits;
      await updateCustomer(customer.id, patch);
      const data = await getCustomer(customer.id);
      login((data.data || data) as Customer);
      toast.success("Dados atualizados!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar dados.");
    } finally {
      setSaving(false);
    }
  };

  const paidCount = items.filter((i) => ["paid","approved","completed"].includes(i.fastdepix_status?.toLowerCase())).length;
  const pendingCount = items.filter((i) => ["pending"].includes(i.fastdepix_status?.toLowerCase())).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-card sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Minha conta</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
            style={{ minHeight: 36, minWidth: 36 }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pt-3 gap-1 border-b border-border">
          {[
            { id: "dados" as const, label: "Meus dados", Icon: User },
            { id: "faturas" as const, label: "Faturas", Icon: Receipt },
          ].map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {tab === "dados" && (
            <div className="p-5">
              <p className="text-xs text-muted-foreground mb-4">
                Mantenha seus dados atualizados para receber lembretes e agilizar cobranças.
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
                    <Phone className="h-3.5 w-3.5" /> WhatsApp
                  </label>
                  <input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                    inputMode="tel"
                    maxLength={16}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm"
                    placeholder="(00) 00000-0000"
                  />
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
          )}

          {tab === "faturas" && (
            <div className="p-4">
              {!loading && !error && items.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Faturas pagas</div>
                    <div className="text-lg font-bold text-foreground">{paidCount}</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Pendentes</div>
                    <div className="text-lg font-bold text-foreground">{pendingCount}</div>
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                {loading && (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                {error && <div className="text-sm text-destructive text-center py-8">{error}</div>}
                {!loading && !error && items.length === 0 && (
                  <div className="text-center py-16">
                    <Receipt className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma fatura ainda.</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Suas renovações via PIX aparecem aqui.</p>
                  </div>
                )}
                {!loading && !error && items.map((inv) => {
                  const st = statusInfo(inv.fastdepix_status);
                  const StIcon = st.Icon;
                  const isPaid = ["paid","approved","completed"].includes(inv.fastdepix_status?.toLowerCase());
                  return (
                    <div key={inv.id} className="card-elevated p-3.5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-foreground truncate">{inv.plan_name}</div>
                          <div className="text-[11px] text-muted-foreground">Criada em {fmtDateTime(inv.created_at)}</div>
                        </div>
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: st.bg, color: st.color }}
                        >
                          <StIcon className="h-3 w-3" />
                          {st.label.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div className="text-[11px] text-muted-foreground">
                          {isPaid && inv.paid_at ? `Pago em ${fmtDate(inv.paid_at)}` : "Aguardando pagamento"}
                        </div>
                        <div className="text-base font-bold text-foreground">{fmtBRL(inv.amount)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé fixo: Suporte + Pedir conteúdo */}
        {whatsappNumber && (
          <div className="border-t border-border p-3 grid grid-cols-2 gap-2 bg-muted/20">
            <a
              href={`https://wa.me/${whatsappNumber}?text=Olá!%20Preciso%20de%20suporte.%20Meu%20usuário%20é%3A%20${encodeURIComponent(customerUsuario)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-background border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
              Suporte
            </a>
            <a
              href={`https://wa.me/${whatsappNumber}?text=Olá!%20Quero%20pedir%20um%20conteúdo.%20Meu%20usuário%20é%3A%20${encodeURIComponent(customerUsuario)}%20-%20Conteúdo%3A%20`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-background border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="h-4 w-4" />
              Pedir conteúdo
            </a>
          </div>
        )}
      </div>

    </div>
  );
}
