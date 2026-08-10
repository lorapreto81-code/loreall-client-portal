import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  X, User, Phone, Mail, Loader2, Receipt,
  CheckCircle2, Clock, XCircle, HelpCircle, Plus,
  KeyRound, Copy, Eye, EyeOff, Check, Lock, UserCircle2, Info, Calendar, ShieldCheck,
  Monitor
} from "lucide-react";
import { updateCustomer, getCustomer, authHeaders } from "@/lib/api";
import { useAuthStore, Customer } from "@/store/authStore";

import { formatDate } from "@/lib/format";


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
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [copied, setCopied] = useState<"user" | "pass" | null>(null);

  const copyValue = async (value: string, which: "user" | "pass") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      toast.success(which === "user" ? "Usuário copiado!" : "Senha copiada!");
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 1500);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

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
          headers: authHeaders(),
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
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmed.split(" ").filter(Boolean).length < 2) return toast.error("Informe seu nome completo.");
    if (phoneDigits.length < 10) return toast.error("WhatsApp inválido.");
    if (!trimmedEmail) return toast.error("Informe seu e-mail.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return toast.error("E-mail inválido.");

    setSaving(true);
    try {
      const patch: Record<string, unknown> = { name: trimmed, whatsapp: phoneDigits, email: trimmedEmail };
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

  const paidCount = items.filter((i) => ["paid", "approved", "completed"].includes(i.fastdepix_status?.toLowerCase())).length;
  const pendingCount = items.filter((i) => ["pending"].includes(i.fastdepix_status?.toLowerCase())).length;

  const renderStatusBadge = (invoice: Invoice) => {
    const info = statusInfo(invoice.fastdepix_status);
    const StatusIcon = info.Icon;
    const isPaid = ["paid", "approved", "completed"].includes(invoice.fastdepix_status?.toLowerCase());

    return (
      <div className="flex flex-col items-end gap-1.5">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ backgroundColor: info.bg, color: info.color }}
        >
          <StatusIcon className="h-3 w-3" />
          {info.label.toUpperCase()}
        </span>
        {isPaid ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9px] text-muted-foreground leading-none">
              Renovado em {fmtDateTime(invoice.renewed_at || invoice.paid_at)}
            </span>
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 rounded text-primary">
              <Lock className="h-2.5 w-2.5" />
              <span className="text-[8px] font-bold uppercase tracking-tight">Transação Segura</span>
            </div>
          </div>
        ) : invoice.fastdepix_status?.toLowerCase() === "pending" && (
          <div className="flex flex-col items-end gap-1">
            <p className="text-[9px] text-muted-foreground italic text-right max-w-[120px]">
              Aguardando confirmação bancária para renovar seu acesso.
            </p>
          </div>
        )}
      </div>
    );
  };

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
            <div className="p-5 space-y-6">
              {/* Seção: Acesso ao App */}
              <div
                className="rounded-2xl p-4 relative overflow-hidden border border-primary/20 bg-primary/5"
                style={{
                  boxShadow: "0 8px 32px -8px hsl(var(--primary) / 0.2)",
                }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="rounded-xl p-2 bg-primary/20">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Credenciais de Acesso</h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Use no seu aplicativo</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-1.5">
                      <UserCircle2 className="h-3 w-3" /> Usuário
                    </label>
                    <div className="flex items-center gap-2 rounded-xl bg-background/50 border border-border/50 px-3.5 py-2.5 group transition-all focus-within:border-primary/50">
                      <div className="flex-1 text-sm font-mono font-bold text-foreground truncate select-all">
                        {String((customer as any)?.usuario || "—")}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyValue(String((customer as any)?.usuario || ""), "user")}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                      >
                        {copied === "user" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-1.5">
                      <Lock className="h-3 w-3" /> Senha
                    </label>
                    <div className="flex items-center gap-2 rounded-xl bg-background/50 border border-border/50 px-3.5 py-2.5 group transition-all focus-within:border-primary/50">
                      <div className="flex-1 text-sm font-mono font-bold text-foreground truncate select-all">
                        {showPass
                          ? String((customer as any)?.password || "—")
                          : "••••••••"}
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setShowPass((v) => !v)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        >
                          {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyValue(String((customer as any)?.password || ""), "pass")}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        >
                          {copied === "pass" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 flex items-start gap-2 p-2.5 rounded-lg bg-black/20 text-[10px] text-muted-foreground italic border border-white/5">
                  <Info className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                  <span>Dica: Toque nos ícones para copiar. Mantenha esses dados seguros e não os compartilhe.</span>
                </div>
              </div>

              {/* Seção: Perfil */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <User className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Perfil do Cliente</h3>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground ml-1">Nome completo</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border/50 text-sm focus:border-primary/50 outline-none transition-all"
                      placeholder="Seu nome completo"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground ml-1">WhatsApp</label>
                      <input
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                        inputMode="tel"
                        maxLength={16}
                        className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border/50 text-sm focus:border-primary/50 outline-none transition-all"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground ml-1">E-mail</label>
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border/50 text-sm focus:border-primary/50 outline-none transition-all"
                        placeholder="voce@email.com"
                      />
                    </div>
                  </div>
                </div>

                {(() => {
                  const raw = String((customer as any)?.cpf || "");
                  const digits = onlyDigits(raw);
                  if (digits.length >= 11) {
                    return (
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-emerald-500/10">
                            <ShieldCheck className="h-4 w-4 text-emerald-500" />
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Documento Verificado</div>
                            <div className="text-sm font-mono font-bold text-foreground">
                              {digits.length === 11 
                                ? `***.***.${digits.slice(6, 9)}-${digits.slice(9)}`
                                : `**.***.***/${digits.slice(8, 12)}-**`}
                            </div>
                          </div>
                        </div>
                        <div className="text-[9px] font-black text-emerald-500/50 uppercase vertical-text tracking-tighter">PIX OK</div>
                      </div>
                    );
                  }
                  return (
                    <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3">
                      <Info className="h-4 w-4 text-amber-500/60 mt-0.5" />
                      <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                        O CPF será solicitado automaticamente ao realizar o primeiro pagamento via Pix no sistema.
                      </p>
                    </div>
                  );
                })()}

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary-gradient w-full py-4 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Salvar Alterações"}
                </button>
              </div>

              {/* Seção: Servidor / App Info */}
              {((customer as any)?.iptv_provider || (customer as any)?.data_vencimento_app) && (
                <div className="pt-2 border-t border-border/50 space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <Monitor className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Informações Técnicas</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {(customer as any)?.iptv_provider && (
                      <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Servidor</div>
                        <div className="text-sm font-bold text-foreground">{(customer as any).iptv_provider}</div>
                      </div>
                    )}
                    {(customer as any)?.data_vencimento_app && (
                      <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">App expira em</div>
                        <div className="text-sm font-bold text-foreground">{formatDate((customer as any).data_vencimento_app)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
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

                {!loading && items.length > 0 && (
                  <div className="space-y-2.5">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border bg-card/50 p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-foreground truncate">{item.plan_name}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {fmtDate(item.created_at)} · {fmtBRL(item.amount)}
                          </div>
                        </div>
                        {renderStatusBadge(item)}
                      </div>
                    ))}
                  </div>
                )}
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
