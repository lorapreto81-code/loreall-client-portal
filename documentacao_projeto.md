# Loreall Play - Área do Cliente (VIP)

Este documento explica o funcionamento, arquitetura e integrações do sistema "Loreall Play - Área do Cliente", servindo como base para análise de código, segurança e melhorias.

## 1. Visão Geral
A Área do Cliente é um portal focado em **autoatendimento e renovação**, projetado para ser "Ultra Premium" e extremamente rápido. O sistema centraliza a gestão de acessos de clientes finais integrados ao ecossistema TopGestor (CRM/Faturamento) e SyncPay (Pagamentos).

## 2. Fluxo de Entrada (Autenticação OTP via WhatsApp)
Para garantir segurança e simplicidade (sem senhas decoradas), o cliente entra usando seu **WhatsApp ou E-mail**.

1.  **Identificação:** O cliente insere o identificador (WhatsApp ou E-mail) na página de Login.
2.  **Busca (TopGestor):** A Edge Function `otp-request` busca o cliente no TopGestor via `tgSearchCustomers` (usando `Promise.all` para variantes de telefone como com/sem 55, prefixos, etc.).
3.  **Geração de Código:** Se encontrado, um código numérico de 6 dígitos é gerado, hasheado e armazenado na tabela `public.otp_codes` (Supabase).
4.  **Envio (WhatsApp):** O código é enviado via API **Uazapi** para o WhatsApp principal do cliente cadastrado no CRM.
5.  **Verificação:** O cliente insere o código; a função `otp-verify` valida o hash e emite um token JWT customizado assinado com HMAC-SHA256 (`_shared/auth.ts`).

## 3. Integrações Principais

### TopGestor (CRM & Faturamento)
*   **Proxy de Segurança:** Todas as chamadas ao TopGestor passam pela Edge Function `topgestor-proxy`. O token da API nunca é exposto ao cliente.
*   **Dados:** Consultamos perfil, data de vencimento, status (Ativo/Vencido) e faturas.
*   **Renovação:** Quando um pagamento é detectado, o sistema chama o endpoint `/renew` do TopGestor para estender a validade automaticamente.

### SyncPay (Pagamentos & Recorrência)
*   **Pix e Cartão:** O sistema gera links de pagamento e gerencia assinaturas recorrentes.
*   **Webhook (`syncpay-webhook`):** Recebe notificações de `paid`, `completed`, etc.
*   **Dedup e Atomicidade:** O webhook utiliza locks atômicos no Postgres (`UPDATE ... WHERE status = 'pending' AND renewed_at IS NULL`) para garantir que uma renovação nunca seja processada duas vezes para o mesmo pagamento.

### Uazapi (Notificações)
*   Utilizada para envio de códigos OTP, comprovantes de renovação e alertas de bônus de indicação.

## 4. Sistema de Indicação (Indique e Ganhe)
*   Clientes ativos possuem um link de indicação único.
*   **Regra de Bônus:** O indicador ganha **+30 dias** quando o indicado realiza o **primeiro pagamento** com sucesso.
*   **Validação:** Se o indicador estiver com poucos dias de acesso ou vencido, o bônus fica como `pending_referrer_renewal` e é liberado automaticamente quando o indicador renovar sua própria conta.

## 5. Arquitetura e Segurança
*   **Frontend:** React 18, Tailwind CSS (Glassmorphism), Service Layer (`BaseApi.ts`).
*   **Backend:** Supabase Edge Functions (Deno) com Zod para validação de esquemas.
*   **Proteção:** Rate limiting por IP e Identificador no envio de SMS/WhatsApp para evitar ataques de exaustão de custos.
*   **Privacidade:** Mascaramento de dados sensíveis (ex: exibe apenas o final do WhatsApp do cliente na tela de login).

## 6. Pontos de Atenção para Análise
*   **Performance:** A busca no TopGestor é o gargalo; variantes de telefone são processadas em paralelo.
*   **Resiliência:** O `BaseApi.ts` implementa 5 retentativas com backoff para falhas de rede.
*   **Segurança:** Validar se a lógica de HMAC no `_shared/auth.ts` e o uso de `SECURITY DEFINER` nas funções do banco estão seguindo as melhores práticas.
