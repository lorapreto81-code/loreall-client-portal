
# Fluxo de Indicação com Validação Manual

## O problema real

Hoje o fluxo atual (`/indicacao/:code` → `referrals-api?action=create-trial`) cria o cliente **direto no TopGestor** como trial ativo. Mas na prática o cliente **não consegue acessar nada** enquanto você não criar usuário/senha manualmente no painel Warez/Uniplay. Resultado: cliente cadastrado sem credenciais, você recebe a mensagem no WhatsApp, cria no painel e responde "no braço".

Precisamos formalizar essa fila.

## Novo fluxo end-to-end

```text
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│ Cliente atual   │     │ Indicado         │     │ Admin (você)       │
│ (indicador)     │     │ (novo)           │     │                    │
└────────┬────────┘     └────────┬─────────┘     └─────────┬──────────┘
         │                       │                         │
         │ 1. Copia link do      │                         │
         │   ReferralSheet       │                         │
         ├──────────────────────▶│                         │
         │                       │ 2. Abre /indicacao/CODE │
         │                       │    preenche nome+WA     │
         │                       │                         │
         │                       │ 3. Cria registro em     │
         │                       │    trial_signups        │
         │                       │    status=pending       │
         │                       ├────────────────────────▶│
         │                       │                         │
         │                       │ 4. Vê tela "Cadastro    │ 5. Nova aba
         │                       │    em análise, avisamos │    "Testes Grátis"
         │                       │    no WhatsApp"         │    lista pendentes
         │                       │                         │
         │                       │                         │ 6. Cria user/senha
         │                       │                         │    no Warez/Uniplay
         │                       │                         │
         │                       │                         │ 7. Clica "Aprovar"
         │                       │                         │    preenche user+senha
         │                       │                         │    → cria no TopGestor
         │                       │                         │      via edge function
         │                       │                         │    → registra referral
         │                       │                         │      status=
         │                       │                         │      pending_referrer_
         │                       │                         │      renewal
         │                       │                         │
         │                       │ 8. Recebe link WhatsApp │
         │                       │◀────────────────────────┤    com credenciais
         │                       │                         │
         │                       │ 9. Vai pra /login       │
         │                       │    e usa o sistema      │
         │                       │                         │
         │ 10. Quando o indicado │                         │
         │    renovar (pagar     │                         │
         │    1º PIX), regra     │                         │
         │    atual credita +30d │                         │
         │◀──────────────────────┴─────────────────────────┤
```

## Estados do pré-cadastro (`trial_signups`)

- **pending** — preencheu formulário, aguardando você criar credenciais
- **approved** — você aprovou, cliente criado no TopGestor, credenciais enviadas
- **rejected** — WhatsApp duplicado / suspeito de fraude (com motivo)

Bônus do indicador continua igual (regra da memória): só libera +30 dias quando o indicado **paga o 1º PIX**, não quando é aprovado. Isso evita fraude de gente cadastrando fake pra ganhar bônus.

## Mudanças concretas

### 1. Banco (nova tabela)
`trial_signups` com: `referral_code`, `name`, `whatsapp`, `status`, `topgestor_customer_id` (preenchido só na aprovação), `approved_by`, `rejection_reason`, timestamps.

Índice único em `whatsapp` WHERE status IN ('pending','approved') pra evitar cadastro duplicado.

### 2. Edge function `referrals-api` (edições)
- `action=create-trial` **muda comportamento**: em vez de criar no TopGestor, insere em `trial_signups` com status `pending` e retorna `{ status: 'pending', message: '...' }`.
- `action=list-pending-signups` (novo, admin) — lista fila.
- `action=approve-signup` (novo, admin) — recebe `signup_id`, `usuario`, `senha`, `plan_id`. Cria cliente no TopGestor via API existente, cria registro em `referrals` com status `pending_referrer_renewal`, marca signup como `approved`. Retorna link WhatsApp pronto pro admin mandar pro cliente.
- `action=reject-signup` (novo, admin) — marca como `rejected` com motivo.

### 3. Frontend `IndicacaoTeste.tsx`
Depois de enviar, mostra tela nova: "✓ Cadastro recebido! Estamos preparando seu acesso — você receberá as credenciais no WhatsApp em até X horas." Sem mostrar user/senha (porque ainda não existem).

### 4. Novo painel admin `TrialSignupsTab.tsx`
Aba nova em `/admin` com lista de pendentes: nome, WhatsApp, quem indicou, quando cadastrou. Cada linha tem:
- Botão **Aprovar** → abre modal pedindo usuário, senha e plano → chama `approve-signup` → mostra botão "Enviar credenciais no WhatsApp" com mensagem pré-formatada.
- Botão **Rejeitar** → pede motivo → marca como rejeitado.

Também mostra histórico de aprovados/rejeitados com filtro.

### 5. `ReferralSheet.tsx` (ajuste leve de copy)
Trocar texto pra deixar claro que o bônus vem quando o indicado **pagar** (não quando cadastrar), evitando expectativa errada.

## Sobre o desconto de 5%

**Recomendo NÃO implementar agora.** Motivos:
1. O indicado já ganha teste grátis (dias configuráveis no admin) — já é um incentivo forte.
2. Aplicar 5% no 1º PIX exige mexer em `fastdepix-create-pix`, criar tabela de cupons, e uma flag "primeiro pagamento" no cliente. É outro projeto.
3. Se depois quiser adicionar, dá pra fazer isolado sem retrabalho no fluxo de aprovação.

Se você quiser mesmo o desconto, marco pra fazer numa segunda leva.

## Ordem de implementação

1. Migration `trial_signups` + grants + RLS + policies
2. Editar `referrals-api` (mudar create-trial + adicionar approve/reject/list)
3. Atualizar `IndicacaoTeste.tsx` (tela de "em análise")
4. Criar `TrialSignupsTab.tsx` e plugar em `Admin.tsx`
5. Ajuste de copy no `ReferralSheet.tsx`

## Detalhes técnicos

- Autenticação admin: reusar o padrão de `ReferralTrialConfigTab` (mesma proteção já existente pras rotas admin do `referrals-api`).
- Mensagem WhatsApp de aprovação: template com nome, usuário, senha, plano, dias de teste, link de download do app. Botão copia URL `wa.me` já pronta.
- Rejeição de WhatsApp duplicado: se já existe signup pending/approved com mesmo WhatsApp, `create-trial` retorna erro com link pro suporte (comportamento atual já existe, mantém).
- TopGestor: criação usa endpoint `POST /customers` via `topgestor-proxy` — precisa adicionar action `create-customer` no proxy se ainda não tiver (verificar).

Aprova esse plano ou quer ajustar algo (ex: incluir o desconto de 5% agora, mudar copy, adicionar auto-aprovação em casos específicos)?
