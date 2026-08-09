import { useState, useEffect } from "react";
import { resellerAdmin } from "@/lib/resellerAdmin";
import { Megaphone, Save, Lock, Link2, ListChecks, BarChart3, Settings, Users, LineChart, Gift, ArrowLeftRight, Database, Repeat, Inbox, ShieldCheck, History, RefreshCcw } from "lucide-react";
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
import SyncpayActiveSubscribersTab from "@/components/admin/SyncpayActiveSubscribersTab";
import OtpAuditTab from "@/components/admin/OtpAuditTab";
import PaymentAuditTab from "@/components/admin/PaymentAuditTab";

interface Notice {
  ativo: boolean;
  mensagem: string;
  atualizado_em: string;
}

type TabGroup = "revendedores" | "clientes" | "assinaturas" | "auditoria" | "config";
type Tab = "avisos" | "links" | "recargas" | "clientes" | "assinaturas" | "assinaturas-ativas" | "auditoria-acesso" | "auditoria-pagamento" | "pix-provider" | "config";

const GROUPED_TABS: { group: TabGroup; label: string; icon: typeof Users; tabs: { id: Tab; label: string; icon: typeof Megaphone }[] }[] = [
  {
    group: "revendedores",
    label: "Revendedores",
    icon: Link2,
    tabs: [
      { id: "links", label: "Links de Revenda", icon: Link2 },
      { id: "recargas", label: "Histórico de Recargas", icon: ListChecks },
    ]
  },
  {
    group: "clientes",
    label: "Clientes",
    icon: Users,
    tabs: [
      { id: "clientes", label: "Pagamentos Diretos", icon: Users },
      { id: "assinaturas-ativas", label: "Assinantes Ativos", icon: ShieldCheck },
    ]
  },
  {
    group: "assinaturas",
    label: "Recorrência",
    icon: Repeat,
    tabs: [
      { id: "assinaturas", label: "Planos SyncPay", icon: Repeat },
    ]
  },
  {
    group: "auditoria",
    label: "Auditoria & Acessos",
    icon: History,
    tabs: [
      { id: "auditoria-acesso", label: "Logs de Acesso OTP", icon: History },
      { id: "auditoria-pagamento", label: "Logs de Renovação", icon: RefreshCcw },
    ]
  },
  {
    group: "config",
    label: "Configurações",
    icon: Settings,
    tabs: [
      { id: "avisos", label: "Comunicados/Avisos", icon: Megaphone },
      { id: "pix-provider", label: "Provedores PIX", icon: ArrowLeftRight },
      { id: "config", label: "Ajustes Gerais", icon: Settings },
    ]
  }
];

const Admin = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [activeGroup, setActiveGroup] = useState<TabGroup | null>(null);
  const [tab, setTab] = useState<Tab>("links");

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
    if (sessionStorage.getItem("admin_password")) {
      // Revalida a senha guardada no servidor antes de liberar o painel.
      resellerAdmin
        .getConfig()
        .then(() => setAuthenticated(true))
        .catch(() => sessionStorage.removeItem("admin_password"));
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setChecking(true);
    // A senha é validada exclusivamente no servidor (edge functions).
    sessionStorage.setItem("admin_password", password);
    try {
      await resellerAdmin.getConfig();
      setAuthenticated(true);
    } catch {
      sessionStorage.removeItem("admin_password");
      alert("Senha incorreta.");
    } finally {
      setChecking(false);
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
            <button type="submit" disabled={checking} className="w-full py-3 btn-primary-gradient font-semibold text-sm disabled:opacity-60">
              {checking ? "Verificando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans selection:bg-primary/30">
      {/* Sidebar para PC / Topbar para Mobile */}
      <aside className="w-full md:w-72 md:min-h-screen bg-card/40 border-b md:border-b-0 md:border-r border-border/50 sticky top-0 z-30 backdrop-blur-2xl shrink-0">
        <div className="p-5 md:p-8 flex md:flex-col items-center justify-between md:items-start gap-4 h-full overflow-y-auto">
          <div className="flex items-center gap-4 mb-0 md:mb-12 group">
            <div className="p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors duration-300">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <div className="hidden md:block">
              <h1 className="text-xl font-bold text-foreground leading-tight tracking-tight">Loreall Admin</h1>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest opacity-70">Sistema de Gestão</p>
            </div>
          </div>
          
          <nav className="hidden md:flex flex-col w-full gap-8">
            {GROUPED_TABS.map((group) => {
              const Icon = group.icon;
              return (
                <div key={group.group} className="space-y-3">
                  <div className="flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
                    <Icon className="h-3.5 w-3.5" />
                    {group.label}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {group.tabs.map((t) => {
                      const SubIcon = t.icon;
                      const isTabActive = tab === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setTab(t.id)}
                          className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-300 group ${
                            isTabActive
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:translate-x-1"
                          }`}
                        >
                          <SubIcon className={`h-4 w-4 transition-transform duration-300 ${isTabActive ? "scale-110" : "group-hover:scale-110"}`} />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Mobile Navigation (Scrollable horizontally) */}
          <div className="flex md:hidden overflow-x-auto gap-3 pb-2 -mb-2 no-scrollbar">
            {GROUPED_TABS.map((group) => {
              const Icon = group.icon;
              const hasActiveTabInGroup = group.tabs.some(t => t.id === tab);
              return (
                <div key={group.group} className="relative shrink-0">
                  <button
                    onClick={() => setActiveGroup(activeGroup === group.group ? null : group.group)}
                    className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                      hasActiveTabInGroup 
                        ? "bg-primary text-primary-foreground border-primary shadow-md" 
                        : "bg-muted/40 text-muted-foreground border-border/40"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {group.label}
                  </button>
                  {activeGroup === group.group && (
                    <div className="absolute top-full mt-3 left-0 bg-card/95 border border-border/60 shadow-2xl rounded-2xl p-2.5 min-w-[200px] z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex flex-col gap-1.5">
                        {group.tabs.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setTab(t.id);
                              setActiveGroup(null);
                            }}
                            className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-[13px] font-semibold ${
                              tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground active:bg-muted/50"
                            }`}
                          >
                            <t.icon className="h-4 w-4" />
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-6 py-10 md:px-12 md:py-16">
          <div className="mb-10 md:mb-16 animate-in fade-in slide-in-from-left-4 duration-700">
            <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight mb-2">
              {GROUPED_TABS.find(g => g.tabs.some(t => t.id === tab))?.label}
            </h2>
            <p className="text-muted-foreground text-sm md:text-base font-medium opacity-80">
              {GROUPED_TABS.find(g => g.tabs.some(t => t.id === tab))?.tabs.find(t => t.id === tab)?.label}
            </p>
          </div>
          {tab === "avisos" && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="card-elevated p-8 space-y-6 border border-primary/5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Megaphone className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">Comunicados ao Cliente</h2>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-foreground">Status do Aviso</span>
                    <p className="text-xs text-muted-foreground">Define se a mensagem será exibida na área do cliente</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                    <div className="w-12 h-6 bg-muted peer-checked:bg-primary rounded-full transition-colors duration-300" />
                    <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${ativo ? "translate-x-6 shadow-sm" : ""}`} />
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    Mensagem do Banner
                  </label>
                  <textarea
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    rows={5}
                    placeholder="Digite aqui o comunicado importante para seus clientes..."
                    className="w-full px-4 py-3 rounded-xl border border-input bg-card/50 text-foreground text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground italic text-right">
                    Última atualização: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
                  </p>
                </div>

                <button 
                  onClick={handleSaveAviso} 
                  className="w-full py-4 btn-primary-gradient font-bold text-sm inline-flex items-center justify-center gap-2 rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Save className="h-4 w-4" /> 
                  Publicar Alterações
                </button>
              </div>
            </div>
          )}
          {tab === "links" && <ResellerLinksTab />}
          {tab === "recargas" && <ResellerPurchasesTab />}
          {tab === "clientes" && <CustomersPaymentsTab />}
          {tab === "assinaturas" && <SyncpaySubscriptionsTab />}
          {tab === "assinaturas-ativas" && <SyncpayActiveSubscribersTab />}
          {tab === "auditoria-acesso" && <OtpAuditTab />}
          {tab === "auditoria-pagamento" && <PaymentAuditTab />}
          {tab === "pix-provider" && <PixProviderTab />}
          {tab === "config" && <ResellerConfigTab />}
        </div>
      </main>
    </div>
  );
};

export default Admin;
