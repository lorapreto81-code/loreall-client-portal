import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Gift, User, Calendar, Package, ArrowLeft, MessageCircle, Search, Lock } from "lucide-react";
import { customerLogin, LoginAccount } from "@/lib/api";
import { useAuthStore, Customer } from "@/store/authStore";
import indiqueBanner from "@/assets/indique-ganhe-banner.jpg.asset.json";
const logo = "/logo.png";

const onlyDigits = (s: string) => s.replace(/\D/g, "");
const REF_KEY = "loreall_pending_ref";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatDate = (s?: string) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR");
};

const maskName = (raw?: string) => {
  if (!raw) return "—";
  return raw
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 2) return word;
      if (word.length === 3) return word[0] + "•" + word[2];
      const start = word.slice(0, 2);
      const end = word.slice(-1);
      const middle = "•".repeat(Math.max(2, word.length - 3));
      return start + middle + end;
    })
    .join(" ");
};

const Login = () => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [matches, setMatches] = useState<LoginAccount[]>([]);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      const code = ref.trim().toUpperCase();
      localStorage.setItem(REF_KEY, code);
      navigate(`/indicacao/${code}`, { replace: true });
      return;
    }
    const stored = localStorage.getItem(REF_KEY);
    if (stored) setRefCode(stored);
  }, [navigate]);

  const pickAccount = (account: LoginAccount) => {
    const c = account.customer as unknown as Customer;
    login(c, account.token);
    toast.success("Bem-vindo, " + c.name + "!");
    navigate("/welcome");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = identifier.trim();
    if (!id) {
      toast.error("Informe seu e-mail, celular ou usuário.");
      return;
    }
    if (!password) {
      toast.error("Informe sua senha de acesso.");
      return;
    }
    setLoading(true);
    try {
      const { accounts } = await customerLogin(id, password);
      if (!accounts || accounts.length === 0) {
        toast.error("Dados de acesso inválidos.");
        return;
      }
      if (accounts.length === 1) {
        pickAccount(accounts[0]);
        return;
      }
      setMatches(accounts);
    } catch (err: any) {
      toast.error(err.message || "Erro ao acessar sua conta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 relative overflow-hidden">
      {/* Ambient gradient glow */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-primary/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[380px] h-[380px] rounded-full bg-secondary/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 flex flex-col gap-4">
        {/* Logo compacta + wordmark */}
        <div className="flex flex-col items-center gap-1.5 pt-1">
          <img src={logo} alt="Loreall Play TV" style={{ width: 64, height: "auto" }} />
          <p className="text-[10px] font-semibold tracking-[0.4em] text-muted-foreground uppercase">
            Seus dados de acesso
          </p>
        </div>

        <div
          className="rounded-2xl p-5 border border-border/60 bg-card/95 backdrop-blur-xl"
          style={{ boxShadow: "0 20px 50px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset" }}
        >
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
                Encontramos {matches.length} contas. Selecione qual deseja abrir:
              </p>
              <div className="space-y-2.5">
                {matches.map((account) => {
                  const c = account.customer as unknown as Customer;
                  const planName = (c.plan as any)?.name || (c as any).product?.name || "—";
                  return (
                    <button
                      key={c.id}
                      onClick={() => pickAccount(account)}
                      className="w-full text-left p-3 rounded-lg border border-input bg-card hover:border-ring hover:bg-accent/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-foreground text-sm truncate">
                          {maskName(c.usuario || c.name)}
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
              <p className="text-sm text-muted-foreground mb-4 leading-snug">
                Acesse com seu <span className="font-semibold text-foreground">celular</span>,
                <span className="font-semibold text-foreground"> e-mail</span> ou
                <span className="font-semibold text-foreground"> usuário</span> e a sua
                <span className="font-semibold text-foreground"> senha de acesso</span> para
                consultar seus dados e renovar seu plano.
              </p>

              {refCode && (
                <div className="mb-4 p-3 rounded-lg flex items-start gap-2.5" style={{ background: "rgba(123, 47, 212, 0.08)", border: "1px solid rgba(123, 47, 212, 0.2)" }}>
                  <Gift className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#7B2FD4" }} />
                  <div className="text-xs text-foreground">
                    Você foi indicado com o código <span className="font-bold">{refCode}</span>. Ao renovar via PIX, seu indicador ganha 1 mês grátis.
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow text-sm"
                    placeholder="Celular ou usuário"
                    autoComplete="username"
                  />
                  <Search className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>

                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow text-sm"
                    placeholder="Senha de acesso"
                    autoComplete="current-password"
                  />
                  <Lock className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 btn-primary-gradient font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 uppercase tracking-wide"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin-slow" /> : <Search className="h-4 w-4" />}
                  {loading ? "Consultando..." : "Acessar minha conta"}
                </button>

                <p className="text-[11px] text-muted-foreground text-center pt-1">
                  Em breve o login também será por e-mail.
                </p>
              </form>

              <a
                href="https://wa.me/5583985591952?text=Olá!%20Não%20tenho%20acesso%20e%20gostaria%20de%20criar%20minha%20conta%20na%20Loreall%20Play%20TV."
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 w-full py-2.5 flex items-center justify-center gap-2 rounded-lg border border-input bg-background text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                Criar minha conta
              </a>
            </>
          )}
        </div>

        {/* Banner Indique e Ganhe */}
        <a
          href="https://wa.me/5583985591952?text=Olá!%20Quero%20saber%20mais%20sobre%20a%20promoção%20Indique%20e%20Ganhe."
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-2xl overflow-hidden border border-border/60 transition-transform hover:scale-[1.01] active:scale-[0.99] bg-card/40"
          style={{ boxShadow: "0 20px 50px -20px rgba(0,0,0,0.6)" }}
          aria-label="Indique e ganhe 1 mês grátis"
        >
          <img
            src={indiqueBanner.url}
            alt="Indique e ganhe +1 mês grátis para cada amigo que assinar"
            className="w-full h-auto block"
            loading="lazy"
          />
        </a>

        <p className="text-[10px] text-muted-foreground/60 text-center">
          © Loreall Play TV — Seu entretenimento em qualquer tela.
        </p>
      </div>
    </div>
  );
};

export default Login;
