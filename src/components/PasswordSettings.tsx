import { useEffect, useState } from "react";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getPasswordStatus, setCustomerPassword } from "@/lib/api";

/** Lets a signed-in customer create/change the optional client-area password. */
export const PasswordSettings = () => {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPasswordStatus().then((r) => setHasPassword(r.has_password)).catch(() => setHasPassword(false));
  }, []);

  const save = async () => {
    if (pw.length < 6) return toast.error("A senha precisa ter pelo menos 6 caracteres.");
    if (pw !== confirm) return toast.error("As senhas não conferem.");
    setSaving(true);
    try {
      await setCustomerPassword(pw);
      setHasPassword(true);
      setPw(""); setConfirm("");
      toast.success("Senha salva! Na próxima vez, entre com ela.");
    } catch (e: any) {
      toast.error(e.message || "Não foi possível salvar a senha.");
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full h-11 px-3 rounded-xl border border-border bg-background/70 text-sm text-foreground focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/15";

  return (
    <div className="pt-4 border-t border-border/50 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Senha de acesso</p>
        {hasPassword && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
            <CheckCircle2 className="h-3 w-3" /> Ativa
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        {hasPassword
          ? "Você já entra com senha. Para trocar, digite uma nova abaixo."
          : "Crie uma senha para entrar mais rápido, sem esperar o código. O código continua disponível se você esquecer."}
      </p>
      <input type="password" autoComplete="new-password" placeholder="Nova senha (mín. 6 caracteres)" value={pw} onChange={(e) => setPw(e.target.value.slice(0, 128))} className={input} />
      <input type="password" autoComplete="new-password" placeholder="Confirme a senha" value={confirm} onChange={(e) => setConfirm(e.target.value.slice(0, 128))} className={input} />
      <button onClick={save} disabled={saving || !pw} className="btn-primary-gradient w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : hasPassword ? "Trocar senha" : "Criar senha"}
      </button>
    </div>
  );
};
