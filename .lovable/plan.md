# Plano de Implementação - Refatoração de Assinaturas e Recorrência SyncPay

O objetivo é alinhar a estrutura de assinaturas e recorrência com a documentação oficial da SyncPay (Apidog), garantindo que o fluxo de inscrição (`enroll`), gerenciamento de planos e processamento de webhooks esteja robusto, especialmente para o Pix Automático.

## Mudanças Propostas

### Backend (Edge Functions)

#### 1. `syncpay-subscriptions`
- **Ação `sync-plans`**: Garantir que todos os campos da documentação (como `billing_method`, `checkout_url`, `periodicity_days`, `trial_days`) sejam capturados e sincronizados no banco de dados local.
- **Ação `create-plan`**: Adicionar suporte a campos como `trial_days` e garantir que o `amount` seja tratado corretamente conforme a API (Inteiro em Reais).
- **Ação `list-subscribers`**: Atualizar para usar o endpoint `/subscription-plans/{token}/subscribers` e garantir o mapeamento correto dos dados retornados.

#### 2. `syncpay-subscribe`
- **Payload `/enroll`**: Validar se campos adicionais como `document_type` (CPF/CNPJ) ou `address` (se necessário no futuro) estão alinhados.
- **Resposta**: Refinar a extração de `mandate_id` e `mandate_status` para Pix Automático, garantindo que o `qr_code` retornado seja o de autorização.
- **Logs**: Manter logs detalhados de erros da API SyncPay para depuração rápida.

#### 3. `syncpay-webhook`
- **Eventos de Assinatura**: Implementar tratamento específico para `subscription.created`, `subscription.updated`, `subscription.cancelled`, e eventos de cobrança `charge.paid`.
- **Pix Automático**: Garantir que o `mandate_id` seja associado corretamente e que mudanças de status do mandato (`active`, `cancelled`) sejam refletidas no banco.

### Frontend

#### 1. `SyncpaySubscriptionsTab.tsx`
- Melhorar a exibição dos planos na área admin, incluindo mais detalhes da SyncPay (trial, dias de antecipação).
- Adicionar filtros ou busca se o volume de planos crescer.

#### 2. `RenewalBottomSheet.tsx`
- **Fluxo Pix Automático**: Melhorar a explicação para o usuário final sobre como funciona a autorização no banco (que não é um pagamento imediato de fatura, mas uma autorização de débito).
- **Persistência**: Garantir que, se o cliente já tem uma assinatura ativa, o botão mude para "Gerenciar Assinatura" em vez de criar uma nova.

## Detalhes Técnicos

- **API SyncPay**: Uso rigoroso do base URL `https://api.syncpayments.com.br/api/partner/v1`.
- **Mapeamento de Planos**: Fortalecer a relação entre `syncpay_plans.topgestor_plan_id` e os planos do TopGestor para que a renovação automática no webhook nunca falhe por falta de ID.
- **Segurança**: Validação de assinatura HMAC em todos os webhooks recebidos da SyncPay.

---
Vou prosseguir com a análise detalhada e ajustes pontuais baseados na documentação fornecida.
