## Objetivo
Adicionar **SyncPay** como provedor PIX alternativo ao **Fast Depix** que já existe, mantendo os dois ativos no sistema. O Admin escolhe o provedor padrão (separado para **Clientes** e **Revendedores**) com um botão de troca rápida.

## Arquitetura

```
Cliente / Revendedor
        |
        v
  fastdepix-create-pix  (cliente, renovação)        ── escolhe provedor pelo system_config
  reseller-create-pix   (revendedor, recarga)       ── escolhe provedor pelo system_config
        |
        ├──► Fast Depix  → fastdepix-webhook
        └──► SyncPay     → syncpay-webhook  (novo)
```

Ambos os webhooks chamam a mesma lógica interna de "pagamento confirmado":
- Cliente: renovação no TopGestor + crédito de indicação
- Revendedor: recarga de créditos WAREZ

## Mudanças

### 1. Banco
Adicionar em `system_config` 3 chaves (via migration, com valores padrão):
- `pix_provider_customers` → `fastdepix` | `syncpay` (default `fastdepix`)
- `pix_provider_resellers` → `fastdepix` | `syncpay` (default `fastdepix`)
- `syncpay_api_url` → default `https://api.syncpay.pro`

Adicionar em `payments` e `reseller_credit_purchases`:
- `provider TEXT DEFAULT 'fastdepix'` — para rastrear quem processou cada cobrança

Secrets (vou pedir ao usuário): `SYNCPAY_CLIENT_ID`, `SYNCPAY_CLIENT_SECRET`.

### 2. Edge functions novas
- **`syncpay-client`** (helper interno — não exposto): gera/cacheia o Bearer token (validade 1h) e expõe `createCashIn()` e `getTransaction()`.
- **`syncpay-webhook`** (`verify_jwt = false`): recebe `cashin.create`/`cashin.update`, identifica se é pagamento de cliente ou revendedor pelo `external_id` salvo, e chama a mesma lógica de confirmação já existente nos webhooks Fast Depix.

### 3. Edge functions existentes
- **`fastdepix-create-pix`**: lê `pix_provider_customers`. Se `syncpay`, cria cobrança via SyncPay; senão, mantém fluxo Fast Depix. Resposta normalizada (mesmos campos: `payment_id`, `qr_code_url`, `qr_code_text`, `expires_at`, `amount`).
- **`reseller-create-pix`**: igual, lendo `pix_provider_resellers`.
- **`reseller-check-status`** / **`payment-status`**: quando o registro tem `provider='syncpay'`, consulta `/transaction/{id}` do SyncPay.

### 4. Admin (UI)
Nova aba **"Provedor PIX"** em `src/pages/Admin.tsx` com componente `PixProviderTab.tsx`:
- Card "Clientes (renovações)" com toggle Fast Depix ↔ SyncPay
- Card "Revendedores (recargas)" com toggle Fast Depix ↔ SyncPay
- Status de configuração (mostra se as secrets do SyncPay estão presentes)
- Webhook URL do SyncPay para copiar/colar no painel deles

### 5. Frontend
Sem mudança visível — `src/lib/api.ts` (`createPixPayment`) e `src/lib/resellerApi.ts` continuam chamando as mesmas funções, que internamente roteiam.

## Pontos técnicos
- SyncPay exige `client.cpf` (11 dígitos) sempre. Para renovação de cliente onde não temos CPF, usaremos o CPF cadastrado no TopGestor; se não houver, fallback para um CPF placeholder configurável. Para revendedores, pediremos CPF no checkout só quando o provedor ativo for SyncPay.
- Limite ≥ R$ 500 sem CPF (regra do Fast Depix) não se aplica ao SyncPay — então quando SyncPay estiver ativo, podemos remover o fallback "link de pagamento ≥ R$ 500" (manter comportamento atual quando Fast Depix estiver ativo).
- Token SyncPay cacheado em memória da edge function por ~55 min; renovado on-demand.
- Webhook do SyncPay: `https://qknlbgpesxirghlvalty.supabase.co/functions/v1/syncpay-webhook` (mostrado no Admin para copiar).

## Entregáveis
1. Migration: 3 chaves em `system_config` + coluna `provider` nas 2 tabelas
2. Secrets `SYNCPAY_CLIENT_ID` / `SYNCPAY_CLIENT_SECRET`
3. Edge functions: `syncpay-webhook` (nova) + atualização de `fastdepix-create-pix`, `reseller-create-pix`, `reseller-check-status`, `payment-status`
4. Helper compartilhado SyncPay (inline em cada função, já que edge functions não compartilham módulos facilmente)
5. Nova aba `PixProviderTab` no Admin
6. `config.toml`: `verify_jwt = false` para `syncpay-webhook`

Confirma para eu começar? Vou precisar das credenciais `SYNCPAY_CLIENT_ID` e `SYNCPAY_CLIENT_SECRET` quando você aprovar.