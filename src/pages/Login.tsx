import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { searchCustomer } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
const logo = "/logo.png";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

const Login = () => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = identifier.trim();
    if (!id || !password.trim()) {
      toast.error("Preencha todos os campos.");
      return;
    }
    setLoading(true);
    try {
      const digits = onlyDigits(id);
      const isPhone = digits.length >= 8;
      const query = isPhone ? digits : id;
      const data = await searchCustomer(query);
      const customers = Array.isArray(data) ? data : data?.data ? (Array.isArray(data.data) ? data.data : [data.data]) : [data];
      const found = customers.find((c: any) => {
        if (!isPhone && (c.usuario === id || c.username === id)) return true;
        if (isPhone) {
          const phoneFields = [c.whatsapp, c.celular, c.phone, c.telefone]
            .filter(Boolean)
            .map((v: string) => onlyDigits(String(v)));
          return phoneFields.some((p) => p.endsWith(digits) || digits.endsWith(p));
        }
        return false;
      });
      if (!found) {
        toast.error("Usuário ou celular não encontrado.");
        return;
      }
      if (found.password !== password) {
        toast.error("Senha incorreta.");
        return;
      }
      login(found);
      toast.success("Bem-vindo, " + found.name + "!");
      navigate("/welcome");
    } catch (err: any) {
      toast.error(err.message || "Erro ao fazer login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src={logo} alt="Loreall Play TV" style={{ width: 120, height: "auto" }} />
        </div>
        <div className="card-elevated p-8">
          <h1 className="text-xl font-bold text-foreground text-center mb-6">
            Minha Conta
          </h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Usuário ou celular
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Seu usuário ou celular"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Sua senha"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 btn-primary-gradient font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin-slow" />}
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
