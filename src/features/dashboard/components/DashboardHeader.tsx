import { Sun, Moon, Menu, User } from "lucide-react";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { logo } from "@/utils/constants";
import { firstName } from "@/utils/formatters";

interface Props {
  customer: any;
  theme: string;
  toggleTheme: () => void;
  menuOpen: boolean;
  setMenuOpen: (o: boolean) => void;
  profileIncomplete: boolean;
  children: React.ReactNode;
}

export const DashboardHeader = ({ customer, theme, toggleTheme, menuOpen, setMenuOpen, profileIncomplete, children }: Props) => (
  <header className="bg-card/40 backdrop-blur-2xl sticky top-0 z-10 border-b border-white/5 shadow-sm">
    <div className="flex items-center justify-between px-4 py-2.5 max-w-[480px] mx-auto">
      <div className="flex items-center gap-2.5 min-w-0">
        <img src={logo} alt="Loreall Play TV" style={{ height: 32, width: "auto" }} />
        <div className="hidden min-[360px]:block min-w-0">
          <div className="text-[11px] text-muted-foreground leading-tight">Área do Cliente</div>
          <div className="text-[13px] font-semibold text-foreground leading-tight truncate">Olá, {firstName(customer.name)}!</div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={toggleTheme}
          className="p-2 text-foreground bg-muted/40 hover:bg-muted/60 transition-all rounded-full border border-white/5 hover:scale-110 active:scale-95"
          style={{ minHeight: 40, minWidth: 40, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="p-2 text-foreground bg-muted/40 hover:bg-muted/60 transition-all rounded-full border border-white/5 relative hover:scale-110 active:scale-95">
              <Menu className="h-[18px] w-[18px]" />
              {profileIncomplete && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-warning animate-pulse" />}
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[85vw] max-w-[340px] p-0 flex flex-col">
            <SheetHeader className="p-5 border-b border-border">
              <SheetTitle className="text-left flex items-center gap-3">
                <div className="rounded-full p-2 bg-primary/15"><User className="h-4 w-4 text-primary" /></div>
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground font-normal">Área do Cliente</div>
                  <div className="text-sm font-semibold text-foreground truncate">{customer.name}</div>
                </div>
              </SheetTitle>
            </SheetHeader>
            {children}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  </header>
);