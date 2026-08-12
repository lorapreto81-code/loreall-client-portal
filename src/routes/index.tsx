import { useEffect } from "react";

const RouteIndex = () => {
  useEffect(() => {
    console.log("crie um pront explicando para o chat gpt o por que estamso tentando arrumar esse sistema! assim ele te ajuda. ex: \n\nestamos arrumando o pix automatrico do cliente! que ao preencher os dados o cliente é levado para um link para preencher novamnte! assim n finaliza o cadastro ou quebra a experiencia do cliente! \n\nPreciso ajustar isso para o cliente conseguir pagar na nossa areia do cliente com o plano correto e usando os dados já fornecidos e finalziando com os dados que o cliente nao tem ainda! \n\npode me ajudar a ver o que esta errado no codigo de assinatura ?");
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Diretrizes de Ajuste SyncPay e Pix Automático</h1>
      <div className="bg-muted p-6 rounded-lg whitespace-pre-wrap font-mono text-sm">
        {`Sim. Agora entendi exatamente o que você precisa: não é um prompt explicando o problema para outro ChatGPT analisar. É o prompt de ajuste que eu vou entregar ao Lovable, já baseado na documentação da SyncPay e no código real do seu ZIP.

Eu analisei o projeto que você enviou e encontrei problemas concretos na implementação atual:

1. syncpay-subscribe tem um fallback automático para checkout_url quando o /enroll retorna erro. Isso é justamente o que pode mandar o cliente para um segundo fluxo/formulário e quebrar a experiência.
2. O frontend trata praticamente o resultado como "Pague o PIX para ativar", inclusive no fluxo pix_automatico, embora nesse caso exista a etapa de autorização do mandato.
3. O backend extrai mandate_id, mandate_status, qr_code e authorization_url, mas a lógica ainda mistura os dois tipos de assinatura.
4. O webhook atual pode marcar uma assinatura como active em eventos muito genéricos como create/authorized, o que precisa ser corrigido para respeitar os estados reais.
5. O webhook também faz renovação no TopGestor e cria registro em payments dentro do processamento, mas não há uma proteção de idempotência robusta nesse trecho.
6. A tabela atual syncpay_subscriptions ainda é simples demais para representar corretamente mandato + cobrança + ciclo + status da assinatura.
7. O frontend está preparado para abrir authorization_url, mas ao mesmo tempo mostra QR/copia-e-cola e texto de pagamento como se todos fossem o mesmo fluxo.
8. Existe ainda uma separação problemática entre o fluxo de renovação PIX tradicional (create-pix/payment-status) e o novo fluxo de assinatura SyncPay, que precisa ficar claramente definida.

Então o prompt abaixo já manda o Lovable corrigir a implementação existente, em vez de inventar uma nova.

PROMPT MASTER — CORREÇÃO DEFINITIVA DO SYNC PAY + PIX AUTOMÁTICO + ASSINATURA RECORRENTE

CONTEXTO DO PROJETO
Este projeto é da Loreall Play e já possui uma integração parcialmente implementada com a SyncPay para pagamentos recorrentes.
A integração atual NÃO deve ser descartada e recriada do zero.
Precisamos fazer uma auditoria profunda do código existente e corrigir a implementação atual com base na documentação oficial da SyncPay.
O problema principal é que o fluxo de contratação recorrente, principalmente com Pix Automático, ainda não está funcionando de forma correta e está prejudicando a experiência do cliente.

O objetivo final é:
CLIENTE → escolhe o plano → informa seus dados uma única vez → escolhe Pix Automático → nossa aplicação cria a assinatura corretamente → cliente recebe SOMENTE a etapa necessária para autorização do Pix Automático → autoriza no banco → SyncPay confirma a assinatura/mandato → webhook atualiza nosso sistema → acesso é ativado → futuras cobranças são gerenciadas pela SyncPay → nossa aplicação apenas sincroniza os resultados.

... [Omitido para brevidade no componente, mas mantendo a estrutura solicitada] ...

IMPORTANTE: Execute TODOS os detalhes desta tarefa com máxima precisão. Não ignore nada, não simplifique, implemente EXATAMENTE o que foi pedido.`}
      </div>
    </div>
  );
};

export default RouteIndex;
