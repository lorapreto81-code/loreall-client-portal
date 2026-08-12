import { useEffect } from "react";

const RouteIndex = () => {
  useEffect(() => {
    console.log("crie um pront explicando para o chat gpt o por que estamso tentando arrumar esse sistema! assim ele te ajuda. ex: \n\nestamos arrumando o pix automatrico do cliente! que ao preencher os dados o cliente é levado para um link para preencher novamnte! assim n finaliza o cadastro ou quebra a experiencia do cliente! \n\nPreciso ajustar isso para o cliente conseguir pagar na nossa areia do cliente com o plano correto e usando os dados já fornecidos e finalziando com os dados que o cliente nao tem ainda! \n\npode me ajudar a ver o que esta errado no codigo de assinatura ?");
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Mapeamento Técnico SyncPay</h1>
      <div className="bg-muted p-6 rounded-lg whitespace-pre-wrap font-mono text-sm">
        {`Mapeei o resto da estrutura (Planos + Assinantes + Notificações completos, incluindo os schemas que faltavam). Isso fecha o quadro, mas adianto: nada aqui explica sozinho por que o /enroll ainda está falhando depois da correção do path — pra isso eu ainda preciso do error real, que ninguém colou ainda. Volto nisso no fim.

**O fluxo todo, de ponta a ponta:**

\`\`\`
POST /api/partner/v1/subscription-plans                    → cria o plano
POST /api/partner/v1/subscription-plans/{token}/enroll     → cadastra o assinante
GET  /api/partner/v1/subscriptions/{subscription_token}    → acompanha status
\`\`\`

Duas coisas que valem a pena registrar, porque não eram óbvias:

**1. O corpo da resposta não é consistente entre endpoints.** Criar plano embrulha o resultado em { "data": {...} }. Já o /enroll devolve plano, sem data nenhum ({ subscription_token, status, billing_method, payment } direto na raiz). É por isso que o const sub = spData.data || spData.subscription || spData no código de vocês existe e está certo — ele já absorve essa inconsistência real da API, não é gambiarra à toa.

**2. O terceiro passo usa um token diferente do segundo.** GET /subscriptions/{token} espera o subscription_token que veio na resposta do /enroll — não o token do plano. São dois UUIDs diferentes. Se em algum lugar do código vocês forem implementar o polling de status e reusarem planToken em vez do subscription_token retornado, isso vai dar 404 mesmo com tudo mais certo. Vale anotar antes de chegar nessa parte.

**Sobre acompanhar o mandate_status até ACTIVE:** confirmei — não é por polling no /subscriptions/{token}. O schema SubscriptionResource (o que esse GET retorna) não carrega campo de mandato nenhum. Existe um schema MandateBlock separado (id, status, authorized_at, cancelled_at, cancel_reason) que a doc descreve como "incluído nos eventos de mandato" — ou seja, é entregue via webhook, no mesmo mecanismo do Criar webhook que already existe na doc pra "eventos de assinatura". Então pra saber quando o cliente autorizou o Pix Automático no banco, o caminho é escutar esse evento, não ficar dando GET repetido. Isso é trabalho pra depois de resolver o enroll — só não quero que vocês percam tempo tentando adivinhar isso via polling quando chegar lá.

**As ações de ciclo de vida** (Cancelar, Pausar, Reativar, Reenviar cobrança, Trocar plano da assinatura) eu só tenho o resumo de uma linha de cada — não abri o spec completo de nenhuma ainda porque não bloqueiam nada agora. Trocar plano em especial tem uma seção "Regras:" na doc que não vi o conteúdo — se algum dia vocês forem implementar upgrade/downgrade de plano, vale eu abrir essa página específica antes.

---

**Voltando ao que trava tudo:** esse mapeamento inteiro não muda o fato de que o /enroll (com o path já corrigido) continua devolvendo algo que não é 2xx — se não fosse, o fallback não teria dispar do de novo. Isso só o error real responde, e já vou pedir pela terceira vez porque as duas anteriores não vieram:

1. DevTools → Network → chamada pra syncpay-subscribe → corpo da resposta → campo error. Ou
2. Já que a ferramenta que vocês estão usando pra editar/reimplantar a function claramente tem acesso à infra do Supabase (ela fez o deploy sozinha) — pede pra ela mesma puxar o log mais recente da invocação de syncpay-subscribe e colar aqui o spData que veio da SyncPay. Deve ser mais direto que caçar no navegador.

Sem esse texto, qualquer coisa que eu disser agora vira só mais uma hipótese na pilha.`}
      </div>
    </div>
  );
};

export default RouteIndex;
