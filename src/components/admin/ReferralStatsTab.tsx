import { useQuery } from "@tanstack/react-query";
import { Users, Copy, UserPlus, Clock, Gift, CalendarPlus, Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Stats {
  total_codes: number;
  total_link_copies: number;
  total_signups: number;
  pending_signups: number;
  bonuses_credited: number;
  total_bonus_days_given: number;
}

async function fetchStats(): Promise<Stats> {
  const pwd = sessionStorage.getItem("admin_password") || "";
  const res = await fetch(`${SUPABASE_URL}/functions/v1/referrals-api?action=admin-referral-stats`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "x-admin-password": pwd },
  });
  if (!res.ok) throw new Error("Falha ao carregar estatísticas");
  return res.json();
}

const StatCard = ({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number | string }) => (
  <div className="card-elevated p-4 flex items-center gap-3">
    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div className="min-w-0">
      <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  </div>
);

export default function ReferralStatsTab() {
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-referral-stats"], queryFn: fetchStats });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (error || !data) {
    return <p className="text-sm text-destructive py-8 text-center">Erro ao carregar estatísticas.</p>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground inline-flex items-center gap-2">
          <Gift className="h-5 w-5" /> Indicações — Estatísticas
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Visão geral do programa de indicação.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Users} label="Códigos gerados" value={data.total_codes} />
        <StatCard icon={Copy} label="Links copiados" value={data.total_link_copies} />
        <StatCard icon={UserPlus} label="Cadastros de teste" value={data.total_signups} />
        <StatCard icon={Clock} label="Testes pendentes" value={data.pending_signups} />
        <StatCard icon={Gift} label="Bônus creditados" value={data.bonuses_credited} />
        <StatCard icon={CalendarPlus} label="Dias de bônus dados" value={data.total_bonus_days_given} />
      </div>
    </div>
  );
}
