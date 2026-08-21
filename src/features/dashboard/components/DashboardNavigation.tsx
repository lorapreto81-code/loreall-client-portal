import { User, Receipt, Download, HelpCircle, Gift, LogOut, ChevronRight, LifeBuoy } from "lucide-react";
import { WHATSAPP_NUMBER } from "@/utils/constants";

interface NavProps {
  customer: any;
  profileIncomplete: boolean;
  onOpenAccount: (tab: "dados" | "faturas") => void;
  onNavigate: (path: string) => void;
  onOpenReferral: () => void;
  onOpenSupport: () => void;
  onLogout: () => void;
  onCloseMenu: () => void;
}


export const DashboardNavigation = ({
  customer,
  profileIncomplete,
  onOpenAccount,
  onNavigate,
  onOpenReferral,
  onLogout,
  onCloseMenu
}: NavProps) => (
  <>
    <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
      <button onClick={() => onOpenAccount("dados")} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left">
        <User className="h-[18px] w-[18px] text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground flex items-center gap-2">
            Meus dados
            {profileIncomplete && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-warning/20 text-warning">AÇÃO</span>}
          </div>
          <div className="text-[11px] text-muted-foreground">Perfil, e-mail e WhatsApp</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      <button onClick={() => onOpenAccount("faturas")} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left">
        <Receipt className="h-[18px] w-[18px] text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">Faturas</div>
          <div className="text-[11px] text-muted-foreground">Histórico de pagamentos</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      <button onClick={() => { onCloseMenu(); onNavigate("/instalacao"); }} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left">
        <Download className="h-[18px] w-[18px] text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">Como instalar</div>
          <div className="text-[11px] text-muted-foreground">Apps para Smart TV, Box e celular</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Olá! Preciso de ajuda. Usuário: ${customer.usuario}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onCloseMenu}
        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
      >
        <HelpCircle className="h-[18px] w-[18px] text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">Suporte</div>
          <div className="text-[11px] text-muted-foreground">Falar no WhatsApp</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </a>

      <button onClick={() => { onOpenReferral(); onCloseMenu(); }} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left">
        <Gift className="h-[18px] w-[18px] text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">Indique e ganhe</div>
          <div className="text-[11px] text-muted-foreground">+30 dias grátis por indicação</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </nav>
    <div className="p-3 border-t border-border">
      <button onClick={() => { onCloseMenu(); onLogout(); }} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-destructive/10 transition-colors text-left text-destructive">
        <LogOut className="h-[18px] w-[18px] shrink-0" />
        <div className="text-sm font-medium">Sair da conta</div>
      </button>
    </div>
  </>
);