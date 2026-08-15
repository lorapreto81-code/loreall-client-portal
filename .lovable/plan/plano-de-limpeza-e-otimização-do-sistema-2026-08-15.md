# Plano de Limpeza e Otimização do Sistema

Este plano visa resolver inconsistências introduzidas durante o desenvolvimento, otimizar a performance de login e fechar brechas de auditoria e segurança identificadas nas sessões anteriores.

## Alterações Técnicas

### 1. Padronização de Segurança e CORS
- **reseller-signup-complete**: Substituir o header estático `Access-Control-Allow-Origin: *` pelo uso dinâmico de `corsHeadersFor(req)` do arquivo compartilhado, mantendo a consistência com o restante do ecossistema de Edge Functions.

### 2. Auditoria e Segurança de Pagamentos
- **admin-mark-payment-paid**: 
    - Impedir que pagamentos sejam marcados como "pagos" no banco de dados se a renovação no TopGestor falhar.
    - Adicionar um campo `metadata` no log de pagamento para identificar se a confirmação foi manual (via Admin) ou automática (via Webhook), facilitando auditorias futuras.

### 3. Otimização de Performance no Login
- **tgSearchCustomers (shared/tg.ts)**: Refatorar a lógica de busca para evitar chamadas redundantes ao TopGestor. O sistema passará a buscar por identificadores exatos antes de tentar variantes fonéticas/formatadas, reduzindo a latência no envio do OTP.
- **otp-request**: Reaproveitar os dados do cliente já encontrados durante a busca inicial para evitar que o frontend precise re-validar informações já processadas pelo backend.

### 4. Limpeza de Rotas
- **App.tsx**: Remover a rota `/indicacao` (sem código) que está obsoleta e não é utilizada pelo sistema, simplificando a árvore de navegação.

### 5. Consistência de Edge Functions
- Revisão rápida em todas as funções para garantir que o tratamento de erros e os headers de segurança seguem o mesmo padrão `jsonResponse` e `securityHeadersFor`.

## Resultados Esperados
- Maior velocidade na primeira etapa do login (WhatsApp/Email).
- Auditoria clara de quem e como confirmou cada pagamento.
- Sistema mais robusto contra falhas de integração com APIs externas.
