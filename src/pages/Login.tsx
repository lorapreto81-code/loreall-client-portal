import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Gift, User, Calendar, Package, ArrowLeft, MessageCircle } from "lucide-react";
import { searchCustomer } from "@/lib/api";
import { useAuthStore, Customer } from "@/store/authStore";
const logo = "/logo.png";

const onlyDigits = (s: string) => s.replace(/\D/g, "");
const REF_KEY = "loreall_pending_ref";

const formatDate = (s?: string) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR");
};

const Login = () => {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [matches, setMatches] = useState<Customer[]>([]);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      const code = ref.trim().toUpperCase();
      localStorage.setItem(REF_KEY, code);
      setRefCode(code);
    } else {
      const stored = localStorage.getItem(REF_KEY);
      if (stored) setRefCode(stored);
    }
  }, []);

  const pickAccount = (c: Customer) => {
    login(c);
    toast.success("Bem-vindo, " + c.name + "!");
    navigate("/welcome");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = identifier.trim();
    if (!id) {
      toast.error("Informe seu usuário ou celular.");
      return;
    }
    setLoading(true);
    try {
      const digits = onlyDigits(id);
      const isPhone = digits.length >= 8;
      const query = isPhone ? digits : id;
      const data = await searchCustomer(query);
      const customers = Array.isArray(data) ? data : data?.data ? (Array.isArray(data.data) ? data.data : [data.data]) : [data];
      const filtered = customers.filter((c: any) => {
        if (!isPhone && (c.usuario === id || c.username === id)) return true;
        if (isPhone) {
          const phoneFields = [c.whatsapp, c.celular, c.phone, c.telefone]
            .filter(Boolean)
            .map((v: string) => onlyDigits(String(v)));
          return phoneFields.some((p) => p.endsWith(digits) || digits.endsWith(p));
        }
        return false;
      });
      if (filtered.length === 0) {
        toast.error("Usuário ou celular não encontrado.");
        return;
      }
      if (filtered.length === 1) {
        pickAccount(filtered[0]);
        return;
      }
      setMatches(filtered);
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
          {matches.length > 1 ? (
            <>
              <button
                onClick={() => setMatches([])}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </button>
              <h1 className="text-lg font-bold text-foreground text-center mb-1">
                Escolha um acesso
              </h1>
              <p className="text-xs text-muted-foreground text-center mb-5">
                Encontramos {matches.length} acessos neste número. Selecione qual deseja abrir:
              </p>
              <div className="space-y-2.5">
                {matches.map((c) => {
                  const planName = (c.plan as any)?.name || (c as any).product?.name || "—";
                  return (
                    <button
                      key={c.id}
                      onClick={() => pickAccount(c)}
                      className="w-full text-left p-3 rounded-lg border border-input bg-card hover:border-ring hover:bg-accent/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-foreground text-sm truncate">
                          {c.usuario || c.name}
                        </span>
                        {c.status && (
                          <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                            {c.status}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" /> {planName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {formatDate(c.data_de_vencimento)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-foreground text-center mb-6">
                Minha Conta
              </h1>
              {refCode && (
                <div className="mb-4 p-3 rounded-lg flex items-start gap-2.5" style={{ background: "rgba(123, 47, 212, 0.08)", border: "1px solid rgba(123, 47, 212, 0.2)" }}>
                  <Gift className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#7B2FD4" }} />
                  <div className="text-xs text-foreground">
                    Você foi indicado com o código <span className="font-bold">{refCode}</span>. Ao renovar via PIX, seu indicador ganha 1 mês grátis.
                  </div>
                </div>
              )}
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 btn-primary-gradient font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin-slow" />}
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </form>

              <a
                href="https://wa.me/5583985591952?text=Olá!%20Não%20tenho%20acesso%20e%20gostaria%20de%20criar%20minha%20conta%20na%20Loreall%20Play%20TV."
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 w-full py-3 flex items-center justify-center gap-2 rounded-lg border border-input bg-background text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                Não tenho acesso — quero criar minha conta
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
