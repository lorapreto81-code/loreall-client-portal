import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Copy, Check, Gift, Share2, Loader2, Clock, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { getOrCreateReferralCode, listReferralsByReferrer } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
}

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
};

const ReferralSheet = ({ open, onClose }: Props) => {
  const { customer } = useAuthStore();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const codeQuery = useQuery({
    queryKey: ["referral-code", customer?.id],
    queryFn: () => getOrCreateReferralCode(customer!.id, customer!.name),
    enabled: !!customer && open,
    staleTime: 5 * 60 * 1000,
  });

  const listQuery = useQuery({
    queryKey: ["referral-list", customer?.id],
    queryFn: () => listReferralsByReferrer(customer!.id),
    enabled: !!customer && open,
    refetchInterval: open ? 15_000 : false,
  });

  if (!open || !customer) return null;

  const code = codeQuery.data?.code || "";
  const shareUrl = code ? `https://pagartv.online/login?ref=${code}` : "";
  const stats = listQuery.data;

  const copy = async (text: string, kind: "code" | "link") => {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    toast.success("Copiado!");
    setTimeout(() => setCopied(null), 1500);
  };

  const share = async () => {
    const text =
      `🎬 *Loreall Play TV* — filmes, séries e canais ao vivo no seu celular, TV e PC.\n\n` +
      `Use meu código de indicação *${code}* ao renovar e ganhe acesso premium.\n\n` +
      `👉 Acesse: ${shareUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Loreall Play TV", text, url: shareUrl });
        return;
      } catch { /* user cancelled */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card w-full max-w-[480px] rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-200 max-h-[92vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-2" style={{ minHeight: 44, minWidth: 44 }}>
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Gift className="h-5 w-5" style={{ color: "#7B2FD4" }} />
          <h3 className="text-lg font-bold text-foreground">Indique e ganhe</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Cada amigo que renovar com seu código te dá <span className="font-semibold text-foreground">+30 dias grátis</span>. Sem limite de indicações!
        </p>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="card-elevated p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Confirmadas</p>
            <p className="text-xl font-bold text-foreground">{stats?.credited ?? "—"}</p>
          </div>
          <div className="card-elevated p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pendentes</p>
            <p className="text-xl font-bold text-foreground">{stats?.pending ?? "—"}</p>
          </div>
          <div className="card-elevated p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Dias ganhos</p>
            <p className="text-xl font-bold text-foreground">{stats?.total_days ?? "—"}</p>
          </div>
        </div>

        {/* Código */}
        {codeQuery.isLoading ? (
          <div className="h-24 bg-muted animate-pulse rounded-xl mb-4" />
        ) : code ? (
          <>
            <p className="text-xs text-muted-foreground mb-1.5">Seu código</p>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 bg-muted rounded-lg px-4 py-3 font-mono text-xl font-bold text-center tracking-widest text-foreground">
                {code}
              </div>
              <button
                onClick={() => copy(code, "code")}
                className="px-3 rounded-lg flex items-center justify-center"
                style={{ minHeight: 48, minWidth: 48, border: "1.5px solid hsl(var(--secondary))", color: "hsl(var(--secondary))" }}
              >
                {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-1.5">Link de indicação</p>
            <div className="bg-muted rounded-lg p-2.5 mb-3">
              <p className="text-[11px] text-foreground break-all font-mono">{shareUrl}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-5">
              <button
                onClick={() => copy(shareUrl, "link")}
                className="px-4 py-3 text-sm rounded-lg inline-flex items-center justify-center gap-1.5"
                style={{ minHeight: 48, border: "1.5px solid hsl(var(--secondary))", color: "hsl(var(--secondary))" }}
              >
                {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === "link" ? "Copiado!" : "Copiar link"}
              </button>
              <button
                onClick={share}
                className="btn-primary-gradient px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-1.5"
                style={{ minHeight: 48 }}
              >
                <Share2 className="h-4 w-4" /> Compartilhar
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-destructive mb-4">Não foi possível gerar seu código. Tente novamente.</p>
        )}

        {/* Histórico */}
        <h4 className="text-sm font-semibold text-foreground mb-2">Suas indicações</h4>
        {listQuery.isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...</div>
        ) : !stats?.referrals.length ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Nenhuma indicação ainda. Compartilhe seu código!
          </p>
        ) : (
          <div className="space-y-2">
            {stats.referrals.map((r) => {
              const isCredited = r.status === "credited";
              const Icon = isCredited ? CheckCircle2 : Clock;
              const color = isCredited ? "#5DCAA5" : "#FAC775";
              const label = isCredited
                ? `+${r.bonus_days} dias creditados`
                : r.status === "pending_referrer_renewal"
                  ? "Aguardando você renovar"
                  : "Aguardando pagamento";
              return (
                <div key={r.id} className="card-elevated p-3 flex items-center gap-3">
                  <Icon className="h-5 w-5 shrink-0" style={{ color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {r.referred_customer_name || `Cliente #${r.referred_customer_id}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(r.created_at)} • {label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center mt-4">
          Você precisa estar com o plano <strong>ativo</strong> para receber o bônus. Se faltar 3 dias ou menos para vencer, o bônus libera após sua próxima renovação.
        </p>
      </div>
    </div>
  );
};

export default ReferralSheet;
