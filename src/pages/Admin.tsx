import { useState, useEffect } from "react";
import { Megaphone, Save, Lock, Link2, ListChecks, BarChart3, Settings, Users, LineChart, Gift, ArrowLeftRight, Database, Repeat, Inbox } from "lucide-react";
import ResellerLinksTab from "@/components/admin/ResellerLinksTab";
import ResellerPurchasesTab from "@/components/admin/ResellerPurchasesTab";
import ResellerDashboardTab from "@/components/admin/ResellerDashboardTab";
import ResellerConfigTab from "@/components/admin/ResellerConfigTab";
import CustomersPaymentsTab from "@/components/admin/CustomersPaymentsTab";
import CustomersDashboardTab from "@/components/admin/CustomersDashboardTab";
import ReferralTrialConfigTab from "@/components/admin/ReferralTrialConfigTab";
import TrialSignupsTab from "@/components/admin/TrialSignupsTab";
import PixProviderTab from "@/components/admin/PixProviderTab";
import TopGestorCustomersTab from "@/components/admin/TopGestorCustomersTab";
import SyncpaySubscriptionsTab from "@/components/admin/SyncpaySubscriptionsTab";

const ADMIN_PASSWORD = "@996157342Slyj";

interface Notice {
  ativo: boolean;
  mensagem: string;
  atualizado_em: string;
}

type Tab = "avisos" | "links" | "recargas" | "dashboard" | "clientes" | "clientes-dash" | "tg-clientes" | "config" | "indicacao" | "trial-signups" | "pix-provider" | "assinaturas";

const TABS: { id: Tab; label: string; icon: typeof Megaphone }[] = [
  { id: "avisos", label: "Avisos", icon: Megaphone },
  { id: "links", label: "Revendedores", icon: Link2 },
  { id: "recargas", label: "Recargas", icon: ListChecks },
  { id: "dashboard", label: "Dashboard rev.", icon: BarChart3 },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "clientes-dash", label: "Dashboard cli.", icon: LineChart },
  { id: "tg-clientes", label: "Clientes TG", icon: Database },
  { id: "assinaturas", label: "Assinaturas", icon: Repeat },
  { id: "trial-signups", label: "Testes grátis", icon: Inbox },
  { id: "indicacao", label: "Indicação", icon: Gift },
  { id: "pix-provider", label: "Provedor PIX", icon: ArrowLeftRight },
  { id: "config", label: "Configurações", icon: Settings },
];

const Admin = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("avisos");

  const [ativo, setAtivo] = useState(false);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("admin_aviso");
    if (stored) {
      try {
        const parsed: Notice = JSON.parse(stored);
        setAtivo(parsed.ativo);
        setMensagem(parsed.mensagem || "");
      } catch {
        /* ignore */
      }
    }
    if (sessionStorage.getItem("admin_password") === ADMIN_PASSWORD) {
      setAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem("admin_password", password);
      setAuthenticated(true);
    } else {
      alert("Senha incorreta.");
    }
  };

  const handleSaveAviso = () => {
    const notice: Notice = { ativo, mensagem, atualizado_em: new Date().toISOString() };
    localStorage.setItem("admin_aviso", JSON.stringify(notice));
    alert("Aviso salvo com sucesso!");
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="card-elevated p-8 w-full max-w-sm">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-bold text-foreground">Admin</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Senha de administrador"
            />
            <button type="submit" className="w-full py-3 btn-primary-gradient font-semibold text-sm">
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 sticky top-0 z-30 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="text-lg font-bold text-foreground">Painel Admin</h1>
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {tab === "avisos" && (
          <div className="max-w-xl mx-auto card-elevated p-6 space-y-5">
            <h2 className="text-xl font-bold text-foreground">Painel de avisos</h2>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Aviso ativo</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                <div className="w-11 h-6 bg-muted peer-checked:bg-primary rounded-full transition" />
                <div className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition ${ativo ? "translate-x-5" : ""}`} />
              </label>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Mensagem</label>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={4}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-card text-foreground text-sm"
              />
            </div>
            <button onClick={handleSaveAviso} className="w-full py-3 btn-primary-gradient font-semibold text-sm inline-flex items-center justify-center gap-2">
              <Save className="h-4 w-4" /> Salvar
            </button>
          </div>
        )}
        {tab === "links" && <ResellerLinksTab />}
        {tab === "recargas" && <ResellerPurchasesTab />}
        {tab === "dashboard" && <ResellerDashboardTab />}
        {tab === "clientes" && <CustomersPaymentsTab />}
        {tab === "clientes-dash" && <CustomersDashboardTab />}
        {tab === "tg-clientes" && <TopGestorCustomersTab />}
        {tab === "assinaturas" && <SyncpaySubscriptionsTab />}
        {tab === "trial-signups" && <TrialSignupsTab />}
        {tab === "indicacao" && <ReferralTrialConfigTab />}
        {tab === "pix-provider" && <PixProviderTab />}
        {tab === "config" && <ResellerConfigTab />}
      </div>
    </div>
  );
};

export default Admin;
