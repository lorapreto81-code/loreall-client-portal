# Plan: Autenticação via WhatsApp para Revendedores

Implementar um sistema de login via WhatsApp OTP para os revendedores, permitindo que eles acessem sua área (página `/revendedor/:slug`) de forma segura, similar ao fluxo já existente para clientes.

## User Review Required

> [!IMPORTANT]
> A autenticação será baseada no número de WhatsApp cadastrado na tabela `reseller_links`. Caso um revendedor não tenha número cadastrado, ele não conseguirá logar.

## Proposed Changes

### Database & Schema
- Adicionar coluna `whatsapp` (text) na tabela `public.reseller_links` para armazenar o número de contato do revendedor.
- Atualizar a RLS da `reseller_links` para permitir que o revendedor logado visualize seus próprios dados (já existe, mas garantiremos que o `whatsapp` não vaze publicamente).

### Edge Functions
- **`otp-request`**: Atualizar para suportar um tipo `context: 'reseller'`. Se for revendedor, buscará o número na tabela `reseller_links` em vez de consultar a API do TopGestor.
- **`otp-verify`**: Atualizar para gerar um token JWT específico para revendedores caso o `context` seja `'reseller'`.
- **`reseller-auth` (Nova ou compartilhada)**: Lógica para validar tokens de revendedor.

### Frontend
- **`src/pages/Revendedor.tsx`**:
    - Adicionar um estado de "Não autenticado".
    - Mostrar o `LoginForm` (reutilizando a lógica do cliente ou criando uma variante) quando o revendedor acessar o link.
    - Persistir a sessão do revendedor no `localStorage` (ex: `revendedor_token`).
    - Somente liberar o acesso à área de recarga e painel após a verificação do código.

### Shared Logic
- **`src/features/auth/hooks/useLoginFlow.ts`**: Adaptar para aceitar um parâmetro `mode` ('customer' ou 'reseller').

## Technical Details

- Utilização da tabela `public.otp_codes` já existente para armazenar os códigos temporários.
- A função `tgSearchCustomers` no backend não será usada para revendedores; em vez disso, faremos um `select` simples na tabela `reseller_links` filtrando pelo `slug` e `whatsapp`.
- O token JWT gerado conterá a role `reseller` e o `reseller_id`.

## Verification Plan

1. **Teste de Envio**: Acessar `/revendedor/exemplo`, digitar o número de WhatsApp cadastrado, e verificar se o código chega via Uazapi.
2. **Teste de Validação**: Digitar o código recebido e verificar se a página libera a interface de recarga.
3. **Teste de Segurança**: Tentar acessar a API de recarga de revendedor sem o token e verificar se retorna 401.
