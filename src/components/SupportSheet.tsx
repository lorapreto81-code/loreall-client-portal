import { useState } from "react";
import { X, ChevronDown, LifeBuoy, RefreshCw, Power, Wifi, MessageCircle } from "lucide-react";
import { WHATSAPP_NUMBER } from "@/utils/constants";
import suporteTravando from "@/assets/suporte-travando.png.asset.json";

interface Props {
  open: boolean;
  onClose: () => void;
  customerUsuario?: string;
}

const ITEMS = [
  {
    id: "renovou",
    icon: RefreshCw,
    title: "Renovei agora e ainda não consigo entrar",
    body: [
      "Após a renovação, o aplicativo precisa buscar os dados novos.",
      "Feche o aplicativo por completo e abra novamente.",
      "Se ainda assim não liberar, aguarde 1 minutinho ou desligue o aparelho da tomada por 2 minutos e ligue de novo.",
    ],
  },
  {
    id: "travando",
    icon: Power,
    title: "Meu aplicativo está travando",
    body: [
      "Desligue o aparelho (TV, Box ou celular) da tomada por 2 minutos — e se possível o roteador também.",
      "Aguarde os 2 minutos e ligue tudo novamente.",
      "Abra o aplicativo de novo: na maioria dos casos já normaliza.",
    ],
  },
  {
    id: "nao-abre",
    icon: Wifi,
    title: "Não consigo acessar o aplicativo",
    body: [
      "Confira se sua internet está funcionando em outro app.",
      "Feche o aplicativo, reinicie o aparelho e tente entrar novamente.",
      "Verifique se seu plano está dentro da validade na tela inicial da Área do Cliente.",
    ],
  },
  {
    id: "lento",
    icon: LifeBuoy,
    title: "Está carregando/travando muito durante os canais",
    body: [
      "Prefira conexão por cabo ou fique mais perto do roteador.",
      "Reinicie o roteador por 2 minutos.",
      "Evite muitos aparelhos usando a internet ao mesmo tempo.",
    ],
  },
];

const SupportSheet = ({ open, onClose, customerUsuario }: Props) => {
  const [openId, setOpenId] = useState<string | null>("renovou");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card w-full max-w-[480px] md:max-w-2xl rounded-t-2xl p-5 pb-8 md:p-8 animate-in slide-in-from-bottom duration-200 max-h-[92vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-2"
          style={{ minHeight: 44, minWidth: 44 }}
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-1 pr-10">
          <LifeBuoy className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">Resolve alguns problemas!</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Renovou agora? Se o aplicativo ainda não liberar, feche e abra novamente ou desligue o aparelho por 2 minutos.
        </p>

        <div className="flex flex-col gap-2 mb-5">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const isOpen = openId === item.id;
            return (
              <div key={item.id} className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                <button
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  className="w-full flex items-center gap-3 p-3 text-left"
                >
                  <Icon className="h-[18px] w-[18px] text-primary shrink-0" />
                  <span className="flex-1 text-sm font-medium text-foreground">{item.title}</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <ol className="px-4 pb-3 pl-11 flex flex-col gap-1.5 list-decimal text-[13px] text-muted-foreground">
                    {item.body.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs font-semibold text-foreground mb-2">Passo a passo ilustrado</p>
        <img
          src={suporteTravando.url}
          alt="Passo a passo: desligue o aparelho por 2 minutos, aguarde e entre novamente no aplicativo"
          className="w-full h-auto rounded-xl border border-border/60 mb-5"
          loading="lazy"
        />

        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
            `Olá! Tentei os passos de suporte e ainda estou com problema. Usuário: ${customerUsuario || ""}`
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary-gradient w-full py-3 font-semibold text-sm inline-flex items-center justify-center gap-2 rounded-lg"
          style={{ minHeight: 48 }}
        >
          <MessageCircle className="h-4 w-4" />
          Não resolveu? Falar com o suporte
        </a>
      </div>
    </div>
  );
};

export default SupportSheet;
