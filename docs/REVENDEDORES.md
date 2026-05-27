# Sistema de Revendedores — Documentação Técnica

> Documento de referência para a equipe **Nobre TV** implementar o mesmo fluxo no sistema deles.
> Base: projeto **Loreall Play / PagarTV** (renovartv.lovable.app · pagartv.online).
>
> **Stack:** React + Vite no frontend, Supabase (Postgres + Edge Functions Deno) no backend, **Fast Depix** como gateway PIX e **WAREZ / WPanel** como provedor IPTV.

---

## 1. Visão geral do fluxo

```
┌──────────────┐    1. abre link    ┌────────────────────┐
│ Revendedor   │ ─────────────────▶ │ /revendedor/:slug  │
│ (cliente)    │                    │  (Revendedor.tsx)  │
└──────────────┘                    └─────────┬──────────┘
                                              │ 2. escolhe créditos + "Gerar PIX"
                                              ▼
                                    ┌────────────────────┐
                                    │ reseller-create-pix│  cria transação no Fast Depix
                                    │   (edge function)  │  + insere reseller_credit_purchases
                                    └─────────┬──────────┘
                                              │ retorna QR / copia-cola
                                              ▼
                                    ┌────────────────────┐
                                    │ Frontend faz POLL  │  a cada 3s
                                    │ reseller-check-    │  ── consulta Fast Depix
                                    │ status?id=...      │  ── se "paid" → dispara recarga
                                    └─────────┬──────────┘
                                              │
                                              ▼
                                    ┌────────────────────┐
                                    │ reseller-process-  │  PATCH WAREZ /users/credits/{id}
                                    │ recharge           │  grava status final
                                    └────────────────────┘
```

Estados possíveis em uma compra (`reseller_credit_purchases`):

| Campo              | Valores                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| `status`           | `pending` → `paid` / `expired` / `cancelled`                               |
| `recharge_status`  | `pending` → `processing` → `recharged` / `awaiting_credits` / `failed`     |

---

## 2. Modelo de dados (Postgres)

### 2.1 `reseller_links` — Cadastro dos revendedores

Cada revendedor tem um **link público único** (`/revendedor/{slug}`) ligado a um usuário no painel WAREZ.

```sql
create table public.reseller_links (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,        -- ex: "joao-tv"
  display_name      text not null,               -- "João TV"
  warez_username    text not null,               -- usuário do painel WAREZ
  warez_user_id     integer not null,            -- ID numérico do painel WAREZ
  price_per_credit  numeric not null default 11.00,  -- R$ por crédito
  min_credits       integer not null default 10,
  max_credits       integer not null default 30,
  credits           integer not null,            -- valor base (usado p/ defaults)
  amount            numeric not null,            -- credits * price_per_credit
  is_active         boolean not null default true,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

grant select on public.reseller_links to anon;          -- página pública lê
grant select, insert, update, delete on public.reseller_links to authenticated;
grant all on public.reseller_links to service_role;

alter table public.reseller_links enable row level security;
create policy "Public can view active reseller links"
  on public.reseller_links for select to public
  using (is_active = true);
```

### 2.2 `reseller_credit_purchases` — Cada compra/PIX gerado

```sql
create table public.reseller_credit_purchases (
  id                       uuid primary key default gen_random_uuid(),
  reseller_link_id         uuid references public.reseller_links(id),
  warez_username           text not null,
  warez_user_id            integer not null,
  whatsapp                 text not null default '',
  email                    text not null default '',
  package_credits          integer not null,        -- quantos créditos serão recarregados
  amount                   numeric not null,        -- valor pago em R$
  -- Fast Depix
  fastdepix_transaction_id bigint,
  qr_code_url              text,                    -- QR em base64 ou URL
  qr_code_text             text,                    -- copia-e-cola
  qr_code_expires_at       timestamptz,
  status                   text not null default 'pending',
        -- pending | paid | expired | cancelled
  paid_at                  timestamptz,
  -- Recarga WAREZ
  recharge_status          text not null default 'pending',
        -- pending | processing | recharged | awaiting_credits | failed
  recharged_at             timestamptz,
  warez_response           jsonb,
  error_message            text,
  ip_address               text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

grant all on public.reseller_credit_purchases to service_role;
-- Não dar acesso a anon/authenticated: o frontend só lê via edge function
alter table public.reseller_credit_purchases enable row level security;
```

### 2.3 `warez_api_logs` — Auditoria das chamadas ao painel

```sql
create table public.warez_api_logs (
  id                  uuid primary key default gen_random_uuid(),
  endpoint            text not null,
  method              text not null default 'POST',
  request_body        jsonb not null default '{}',
  response_status     integer not null default 0,
  response_body       text not null default '',
  duration_ms         integer not null default 0,
  error               text,
  related_payment_id  uuid,
  created_at          timestamptz not null default now()
);
grant all on public.warez_api_logs to service_role;
alter table public.warez_api_logs enable row level security;
```

### 2.4 `system_config` — Configurações chave/valor

```sql
create table public.system_config (
  config_key    text primary key,
  config_value  text not null,
  updated_at    timestamptz not null default now()
);
grant all on public.system_config to service_role;
alter table public.system_config enable row level security;
```

Chaves usadas pelo fluxo de revendedor:

| Chave                  | Conteúdo                                                |
| ---------------------- | ------------------------------------------------------- |
| `warez_api_url`        | Base da API WAREZ (sem barra no fim) — ex `https://wpanel.link/api/v1` |
| `warez_api_token`      | Bearer token da API WAREZ                               |
| `warez_admin_user_id`  | ID do **seu** usuário admin no painel (pré-check de saldo) |
| `credit_cost_brl`      | Custo interno por crédito (para dashboard de lucro)     |

---

## 3. Segredos (Edge Function Secrets)

| Nome                              | Uso                                                              |
| --------------------------------- | ---------------------------------------------------------------- |
| `SUPABASE_URL`                    | auto-injetado                                                    |
| `SUPABASE_SERVICE_ROLE_KEY`       | auto-injetado, usado para `createClient` server-side             |
| `FASTDEPIX_RESELLER_API_KEY`      | Bearer token Fast Depix (se diferente do principal)              |
| `FASTDEPIX_API_KEY`               | Fallback se o anterior não existir                               |

**Token da WAREZ fica no banco** (`system_config.warez_api_token`), não em env, para poder ser trocado pelo admin sem deploy.

---

## 4. API WAREZ (WPanel)

Toda a integração é via **HTTP REST** com `Authorization: Bearer <token>`.

### 4.1 GET `/users/{id}` — Pré-checagem de saldo

Usado em `reseller-process-recharge` para verificar se o painel admin tem créditos suficientes **antes** de tentar a recarga.

```
GET {warez_api_url}/users/{warez_admin_user_id}
Authorization: Bearer {warez_api_token}
Accept: application/json
```

Resposta esperada (variações aceitas):
```json
{ "credits": 1500 }
// ou
{ "data": { "credits": 1500 } }
// ou
{ "user": { "credits": 1500 } }
```

Se `credits < package_credits` da compra → marca `recharge_status = 'awaiting_credits'` e **não** chama a recarga.

### 4.2 PATCH `/users/credits/{warez_user_id}` — Recarga

Endpoint principal. Adiciona créditos ao usuário-revendedor.

```
PATCH {warez_api_url}/users/credits/{warez_user_id}
Authorization: Bearer {warez_api_token}
Content-Type: application/json
Accept: application/json

{
  "credits": 10,
  "notes": "Recarga compra #abc12345"
}
```

Tratamento de erro: a resposta é varrida por strings tipo `"insufficient"`, `"saldo insuficiente"`, `"créditos insuficientes"`, `"not enough credit"`, `"no credits"`. Se bater, marca `awaiting_credits` (compra fica em fila esperando o painel ser recarregado pelo dono). Qualquer outro erro → `failed`.

**Toda chamada é logada em `warez_api_logs`** com `related_payment_id = purchase.id`.

---

## 5. API Fast Depix (PIX)

Base: `https://fastdepix.space/api/v1`

### 5.1 POST `/transactions` — Criar PIX

```http
POST https://fastdepix.space/api/v1/transactions
Authorization: Bearer {FASTDEPIX_API_KEY}
Content-Type: application/json

{
  "amount": 110.00,
  "description": "Recarga 10 créditos - usuarioWarez",
  "user": { "name": "usuarioWarez", "email": "slug@renovartv.app" }
}
```

Resposta (campos relevantes):
```json
{
  "data": {
    "id": 123456,
    "qr_code": "data:image/png;base64,...",
    "qr_code_text": "00020126...",
    "qr_code_expires_at": "2026-05-27 10:30:00"
  }
}
```

> O e-mail é obrigatório para o Fast Depix. Como a página do revendedor não pede e-mail, usamos um sintético `{slug}@renovartv.app`. Para valores **abaixo de R$ 500** o Fast Depix não exige CPF.

### 5.2 GET `/transactions/{id}` — Consultar status

```http
GET https://fastdepix.space/api/v1/transactions/{fastdepix_transaction_id}
Authorization: Bearer {FASTDEPIX_API_KEY}
```

Mapeamento de estados (lowercase):
- **paid:** `paid`, `approved`, `completed`, `success`, `succeeded`
- **expired:** `expired`, `cancelled`, `canceled`
- **under_review** (mostra aviso na UI): `under_review`, `processing`, `in_review`, `analyzing`, `analysis`

> No projeto Loreall a confirmação é via **polling** (a página chama `reseller-check-status` a cada 3s). Não usamos webhook do Fast Depix para o fluxo de revendedor (o webhook `fastdepix-webhook` existe apenas para o fluxo de renovação de clientes). Para a Nobre TV recomendamos manter polling — mais simples e zero configuração no Fast Depix.

---

## 6. Edge Functions

Todas em `supabase/functions/<nome>/index.ts`, runtime Deno, deploy automático.
Devem ir em `supabase/config.toml` com `verify_jwt = false` (são chamadas pelo público / por outras functions com service role):

```toml
[functions.reseller-create-pix]
verify_jwt = false
[functions.reseller-check-status]
verify_jwt = false
[functions.reseller-process-recharge]
verify_jwt = false
[functions.reseller-admin]
verify_jwt = false
```

### 6.1 `reseller-create-pix` (POST público)

**Input:**
```json
{ "slug": "joao-tv", "credits": 15, "whatsapp": "83999999999", "email": "opcional@x.com" }
```

**Lógica:**
1. Valida `slug`, busca `reseller_links` ativo.
2. Normaliza WhatsApp (prefixa `55` se necessário).
3. Faz `clamp` de `credits` entre `min_credits` e `max_credits`.
4. Calcula `amount = credits * price_per_credit`.
5. Chama Fast Depix `POST /transactions`.
6. Insere registro em `reseller_credit_purchases` com `status='pending'`.
7. Retorna `{ purchase_id, qr_code_url, qr_code_text, expires_at, amount, package_credits, warez_username }`.

### 6.2 `reseller-check-status` (GET público — polling)

**Input:** `?id={purchase_id}`

**Lógica:**
1. Lê a compra. Se `status='pending'`, consulta Fast Depix `GET /transactions/{id}`.
2. Se PIX pago → `UPDATE ... SET status='paid', paid_at=now() WHERE id=... AND status='pending'` (idempotente) e **invoca** `reseller-process-recharge` em fire-and-forget.
3. Se expirado → marca `status='expired'`.
4. Se já estava `paid` e a recarga não foi feita (`recharge_status` ∈ {`pending`,`failed`,`awaiting_credits`}), re-dispara `reseller-process-recharge` (caminho de recuperação).
5. Retorna o estado atualizado para o front.

### 6.3 `reseller-process-recharge` (POST interno)

Chamada **apenas** por outras edge functions com `Authorization: Bearer ${SERVICE_ROLE_KEY}`.

**Input:** `{ "purchase_id": "<uuid>" }`

**Lógica (resumo já visto no fluxo):**
1. Verifica compra existe, está `paid` e não foi `recharged`.
2. Lê `warez_api_url` / `warez_api_token` / `warez_admin_user_id` do `system_config`.
3. (Opcional) GET `/users/{admin_id}` → se saldo < `package_credits`, marca `awaiting_credits`.
4. **Lock otimista:** `UPDATE ... SET recharge_status='processing' WHERE id=... AND recharge_status != 'recharged'` (evita double-charge).
5. PATCH `/users/credits/{warez_user_id}` com `{credits, notes}`.
6. Loga tudo em `warez_api_logs`.
7. Atualiza compra: `recharged` (sucesso), `awaiting_credits` (saldo do painel) ou `failed` (outro erro).

### 6.4 `reseller-admin` (POST/GET — admin)

Protegida por header `x-admin-password` (compare com o segredo / valor fixo no código — no projeto Loreall está hardcoded; a Nobre TV pode mover para `Deno.env.get("ADMIN_PASSWORD")`).

Roteamento por `?action=`:

| Action               | Método | O que faz                                       |
| -------------------- | ------ | ----------------------------------------------- |
| `list-links`         | GET    | Lista revendedores                              |
| `create-link`        | POST   | Cria revendedor (gera slug único)               |
| `update-link`        | POST   | Atualiza campos                                 |
| `delete-link`        | POST   | Remove                                          |
| `list-purchases`     | GET    | Lista compras (filtros `status`, `since`, `limit`) |
| `reprocess-purchase` | POST   | Força nova tentativa de recarga                 |
| `mark-paid`          | POST   | Marca como pago manualmente + dispara recarga   |
| `close-purchase`     | POST   | `status='cancelled'`                            |
| `delete-purchase`    | POST   | Remove                                          |
| `get-config`         | GET    | Lê `system_config`                              |
| `update-config`      | POST   | Upsert em `system_config`                       |
| `dashboard`          | GET    | KPIs: receita, custo, lucro, margem, por revendedor, série 30d |

---

## 7. Frontend (`src/pages/Revendedor.tsx`)

Página pública em `/revendedor/:slug`. Não exige login.

### 7.1 Carregamento

```ts
const { data } = await supabase
  .from("reseller_links")
  .select("*")
  .eq("slug", slug.toLowerCase())
  .eq("is_active", true)
  .maybeSingle();
```

(Funciona com `anon` por causa da policy pública.)

### 7.2 Gerar PIX

```ts
const r = await fetch(`${SUPABASE_URL}/functions/v1/reseller-create-pix`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
  },
  body: JSON.stringify({ slug, credits }),
});
const pix = await r.json();
// → mostra pix.qr_code_url (img) e pix.qr_code_text (copia-e-cola)
```

### 7.3 Polling de status (3s)

```ts
useEffect(() => {
  if (!pix) return;
  const tick = async () => {
    const r = await fetch(
      `${SUPABASE_URL}/functions/v1/reseller-check-status?id=${pix.purchase_id}`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );
    const s = await r.json();
    setStatus(s);
    if (s.recharge_status === "recharged" || s.status === "expired") {
      clearInterval(pollRef.current!);
    }
  };
  tick();
  pollRef.current = window.setInterval(tick, 3000);
  return () => clearInterval(pollRef.current!);
}, [pix]);
```

### 7.4 Estados de UI

| Sinal                                     | Tela                                                 |
| ----------------------------------------- | ---------------------------------------------------- |
| `recharge_status === 'recharged'`         | ✅ "Créditos liberados no painel"                    |
| `recharge_status === 'awaiting_credits'`  | ⚠️ "Aguardando recarga do painel" + botão suporte    |
| `recharge_status === 'failed'`            | ❌ Mostra `error_message` + botão "Tentar de novo"   |
| `status === 'expired'`                    | "PIX expirado, gere novo"                            |
| `under_review === true`                   | "Pagamento em análise..."                            |

---

## 8. Painel admin

`src/components/admin/ResellerLinksTab.tsx` → CRUD de revendedores.
`src/components/admin/ResellerPurchasesTab.tsx` → lista de compras + ações.
`src/components/admin/ResellerDashboardTab.tsx` → KPIs.
`src/components/admin/ResellerConfigTab.tsx` → editor de `system_config` (URL + token WAREZ, custo por crédito).

Cliente HTTP: `src/lib/resellerAdmin.ts` — todas as chamadas passam `x-admin-password` lido de `sessionStorage`.

---

## 9. Checklist de implementação para a Nobre TV

1. **Banco:** rodar migrations das 4 tabelas acima (`reseller_links`, `reseller_credit_purchases`, `warez_api_logs`, `system_config`).
2. **Secrets:** `FASTDEPIX_API_KEY` (Fast Depix token).
3. **Config:** inserir em `system_config`:
   - `warez_api_url` → base do WPanel
   - `warez_api_token` → token Bearer
   - `warez_admin_user_id` → ID admin (opcional, para pré-check)
   - `credit_cost_brl` → custo interno (opcional, só p/ dashboard)
4. **Edge functions:** copiar os 4 arquivos (`reseller-create-pix`, `reseller-check-status`, `reseller-process-recharge`, `reseller-admin`) e adicionar `verify_jwt = false` no `config.toml`.
5. **Frontend:** página `/revendedor/:slug` + tabs admin.
6. **Testar fluxo end-to-end:**
   - Criar 1 revendedor de teste
   - Gerar PIX de valor mínimo
   - Pagar
   - Verificar `warez_api_logs` e saldo no painel WAREZ

---

## 10. Pontos de atenção

- **Idempotência:** `mark-paid` usa `WHERE status='pending'`, e `process-recharge` faz lock com `WHERE recharge_status != 'recharged'`. Ambos podem ser chamados várias vezes sem cobrar 2x do painel.
- **Race condition pago→recarregado:** o polling re-dispara `process-recharge` se a primeira chamada falhou. Não precisa de cron.
- **Sem webhook do Fast Depix:** confirmação puramente por polling. Vantagem: zero configuração externa.
- **Token WAREZ no banco:** facilita rotação sem deploy, mas o admin precisa estar bem protegido (`x-admin-password`).
- **Pré-check de saldo:** evita tentar recarregar quando o painel admin está zerado, gerando estado claro (`awaiting_credits`) para a UI.
- **Slugs:** sempre `slugify` + checagem de unicidade na criação. Não permitir edição livre do slug sem verificar colisão.
- **CORS:** todas as functions incluem `Access-Control-Allow-Origin: *` e respondem `OPTIONS`.

---

**Contato técnico:** equipe Loreall Play / PagarTV.
