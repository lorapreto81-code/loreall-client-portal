import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock, MessageCircle, Copy, User, Key, Filter } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ADMIN_PASSWORD = "@996157342Slyj";

interface Signup {
  id: string;
  referral_code: string;
  referrer_customer_id: number;
  referrer_customer_name: string | null;
  name: string;
  whatsapp: string;
  status: "pending" | "approved" | "rejected";
  topgestor_customer_id: number | null;
  usuario: string | null;
  password: string | null;
  trial_days: number | null;
  rejection_reason: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
}

type StatusFilter = "pending" | "approved" | "rejected" | "all";

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const formatPhone = (raw: string) => {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

async function callApi(action: string, params: Record<string, string> = {}, options?: { method?: string; body?: Record<string, unknown> }) {
  const qp = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/referrals-api?${qp}`, {
    method: options?.method || "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "x-admin-password": ADMIN_PASSWORD,
    },
    ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

const TrialSignupsTab = () => {
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [approving, setApproving] = useState<Signup | null>(null);
  const [rejecting, setRejecting] = useState<Signup | null>(null);
  const [successCredentials, setSuccessCredentials] = useState<{ signup: Signup; usuario: string; password: string; supportWhatsapp: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter !== "all") params.status = filter;
      const data = await callApi("list-signups", params);
      setSignups(data.signups || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = {
    pending: signups.filter((s) => s.status === "pending").length,
    approved: signups.filter((s) => s.status === "approved").length,
    rejected: signups.filter((s) => s.status === "rejected").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground">Testes Grátis — Fila de Aprovação</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Crie o usuário/senha no painel Warez ou Uniplay, depois aprove aqui para criar o cliente no TopGestor.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {(["pending", "approved", "rejected", "all"] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "pending" && `Pendentes (${filter === "pending" ? counts.pending : ""})`}
            {f === "approved" && "Aprovados"}
            {f === "rejected" && "Rejeitados"}
            {f === "all" && "Todos"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : signups.length === 0 ? (
        <div className="card-elevated p-8 text-center text-sm text-muted-foreground">
          Nenhum cadastro {filter === "pending" ? "pendente" : filter === "all" ? "" : filter === "approved" ? "aprovado" : "rejeitado"}.
        </div>
      ) : (
        <div className="space-y-2">
          {signups.map((s) => (
            <SignupRow key={s.id} signup={s} onApprove={() => setApproving(s)} onReject={() => setRejecting(s)} />
          ))}
        </div>
      )}

      {approving && (
        <ApproveModal
          signup={approving}
          onClose={() => setApproving(null)}
          onSuccess={(usuario, password, supportWhatsapp) => {
            setSuccessCredentials({ signup: approving, usuario, password, supportWhatsapp });
            setApproving(null);
            load();
          }}
        />
      )}

      {rejecting && (
        <RejectModal
          signup={rejecting}
          onClose={() => setRejecting(null)}
          onSuccess={() => {
            setRejecting(null);
            toast.success("Cadastro rejeitado");
            load();
          }}
        />
      )}

      {successCredentials && (
        <SuccessModal
          data={successCredentials}
          onClose={() => setSuccessCredentials(null)}
        />
      )}
    </div>
  );
};

const SignupRow = ({ signup: s, onApprove, onReject }: { signup: Signup; onApprove: () => void; onReject: () => void }) => {
  const created = new Date(s.created_at);
  const ago = Math.floor((Date.now() - created.getTime()) / 60000);
  const agoStr = ago < 60 ? `${ago}min` : ago < 1440 ? `${Math.floor(ago / 60)}h` : `${Math.floor(ago / 1440)}d`;

  return (
    <div className="card-elevated p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground">{s.name}</span>
          <StatusBadge status={s.status} />
          <span className="text-xs text-muted-foreground">há {agoStr}</span>
        </div>
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
          <span>📱 {formatPhone(s.whatsapp)}</span>
          <span>🎁 Indicado por: <strong className="text-foreground">{s.referrer_customer_name || `#${s.referrer_customer_id}`}</strong> ({s.referral_code})</span>
          {s.trial_days && <span>📅 {s.trial_days} dia(s) de teste</span>}
        </div>
        {s.status === "approved" && s.usuario && (
          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
            <span>👤 <code className="font-mono text-foreground">{s.usuario}</code></span>
            <span>🔑 <code className="font-mono text-foreground">{s.password}</code></span>
            <span>🆔 TG: #{s.topgestor_customer_id}</span>
          </div>
        )}
        {s.status === "rejected" && s.rejection_reason && (
          <p className="text-xs text-destructive">Motivo: {s.rejection_reason}</p>
        )}
      </div>
      {s.status === "pending" && (
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onReject}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <XCircle className="h-3.5 w-3.5" /> Rejeitar
          </button>
          <button
            onClick={onApprove}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
          </button>
        </div>
      )}
    </div>
  );
};

const StatusBadge = ({ status }: { status: Signup["status"] }) => {
  const cfg = {
    pending: { label: "Pendente", cls: "bg-amber-500/10 text-amber-500 border-amber-500/30", Icon: Clock },
    approved: { label: "Aprovado", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30", Icon: CheckCircle2 },
    rejected: { label: "Rejeitado", cls: "bg-destructive/10 text-destructive border-destructive/30", Icon: XCircle },
  }[status];
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.cls}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
};

const ApproveModal = ({ signup, onClose, onSuccess }: { signup: Signup; onClose: () => void; onSuccess: (usuario: string, password: string, supportWhatsapp: string) => void }) => {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (usuario.trim().length < 2) return toast.error("Informe o usuário");
    if (password.trim().length < 3) return toast.error("Informe a senha");
    setSubmitting(true);
    try {
      const data = await callApi("approve-signup", {}, {
        method: "POST",
        body: { signup_id: signup.id, usuario: usuario.trim(), password: password.trim() },
      });
      toast.success(`Cliente #${data.customer_id} criado no TopGestor!`);
      onSuccess(usuario.trim(), password.trim(), data.support_whatsapp || "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao aprovar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title={`Aprovar: ${signup.name}`}>
      <p className="text-xs text-muted-foreground mb-4">
        Cole abaixo o usuário e senha que você <strong>já criou</strong> no painel Warez/Uniplay para {signup.name} ({formatPhone(signup.whatsapp)}).
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1.5"><User className="h-3 w-3" /> Usuário</label>
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            maxLength={32}
            autoFocus
            className="w-full mt-1 px-3 py-2.5 rounded-lg border border-input bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="ex: teste123"
            required
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1.5"><Key className="h-3 w-3" /> Senha</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={32}
            className="w-full mt-1 px-3 py-2.5 rounded-lg border border-input bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="ex: xyz789"
            required
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="flex-1 py-2.5 btn-primary-gradient font-semibold text-sm inline-flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {submitting ? "Criando..." : "Aprovar e criar"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

const RejectModal = ({ signup, onClose, onSuccess }: { signup: Signup; onClose: () => void; onSuccess: () => void }) => {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await callApi("reject-signup", {}, {
        method: "POST",
        body: { signup_id: signup.id, reason: reason.trim() },
      });
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao rejeitar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title={`Rejeitar: ${signup.name}`}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Motivo (opcional, visível no histórico)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            rows={3}
            className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="ex: WhatsApp suspeito, tentativa de fraude, etc."
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-semibold text-sm inline-flex items-center justify-center gap-2 hover:opacity-90">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Rejeitar
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

const SuccessModal = ({ data, onClose }: { data: { signup: Signup; usuario: string; password: string; supportWhatsapp: string }; onClose: () => void }) => {
  const { signup, usuario, password, supportWhatsapp } = data;
  const trialDays = signup.trial_days || 1;

  const whatsappMsg =
    `Olá, ${signup.name}! 🎉\n\n` +
    `Seu *teste grátis* na *Loreall Play TV* foi liberado!\n\n` +
    `📅 Duração: ${trialDays} dia(s)\n` +
    `👤 Usuário: *${usuario}*\n` +
    `🔑 Senha: *${password}*\n\n` +
    `Baixe o app e faça login com esses dados. Qualquer dúvida, é só chamar!`;

  const targetWa = signup.whatsapp || onlyDigits(supportWhatsapp);
  const waUrl = targetWa
    ? `https://wa.me/${onlyDigits(targetWa).startsWith("55") ? onlyDigits(targetWa) : "55" + onlyDigits(targetWa)}?text=${encodeURIComponent(whatsappMsg)}`
    : "";

  const copyMsg = async () => {
    await navigator.clipboard.writeText(whatsappMsg);
    toast.success("Mensagem copiada!");
  };

  return (
    <ModalShell onClose={onClose} title="✅ Cliente criado — envie as credenciais">
      <div className="space-y-4">
        <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-emerald-500">Cliente criado no TopGestor</p>
          <p>Agora envie a mensagem abaixo no WhatsApp de {signup.name} ({formatPhone(signup.whatsapp)}).</p>
        </div>

        <div className="bg-muted/40 border border-border rounded-lg p-4 text-xs whitespace-pre-wrap font-mono text-foreground max-h-48 overflow-auto">
          {whatsappMsg}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={copyMsg} className="py-2.5 rounded-lg border border-border text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-muted">
            <Copy className="h-4 w-4" /> Copiar
          </button>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2.5 btn-primary-gradient font-semibold text-sm inline-flex items-center justify-center gap-2"
          >
            <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
          </a>
        </div>

        <button onClick={onClose} className="w-full py-2 text-xs text-muted-foreground hover:text-foreground">
          Fechar
        </button>
      </div>
    </ModalShell>
  );
};

const ModalShell = ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
    <div className="card-elevated p-5 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      {children}
    </div>
  </div>
);

export default TrialSignupsTab;
