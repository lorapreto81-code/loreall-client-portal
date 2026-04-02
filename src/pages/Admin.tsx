import { useState, useEffect } from "react";
import { Megaphone, Save, Lock } from "lucide-react";

const ADMIN_PASSWORD = "loreall2025";

interface Notice {
  ativo: boolean;
  mensagem: string;
  atualizado_em: string;
}

const Admin = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [ativo, setAtivo] = useState(false);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("admin_aviso");
    if (stored) {
      try {
        const parsed: Notice = JSON.parse(stored);
        setAtivo(parsed.ativo);
        setMensagem(parsed.mensagem || "");
      } catch {}
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
    } else {
      alert("Senha incorreta.");
    }
  };

  const handleSave = () => {
    const notice: Notice = {
      ativo,
      mensagem,
      atualizado_em: new Date().toISOString(),
    };
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
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-[480px] mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Painel de avisos</h1>

        <div className="card-elevated p-6 space-y-5">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Aviso ativo</span>
            <button
              onClick={() => setAtivo(!ativo)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                ativo ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform ${
                  ativo ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Textarea */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              Mensagem do aviso
            </label>
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm resize-none"
              placeholder="Ex: Estamos com instabilidade no servidor. Previsão de retorno: 30 minutos."
            />
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            className="w-full py-3 btn-primary-gradient font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" />
            Salvar aviso
          </button>
        </div>

        {/* Preview */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Preview do banner</h2>
          {ativo && mensagem ? (
            <div className="notice-banner rounded-xl border p-3">
              <div className="flex items-center gap-2.5">
                <Megaphone className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium flex-1">{mensagem}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Nenhum aviso ativo para exibir.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
