# Loreall Play areia do cliente 2.0

Crie uma área do cliente chamada "Minha Conta" integrada com a API REST do TopGestor (https://topgestor.me/api/v1) usando autenticação Bearer Token (Laravel Sanctum).

---

## AUTENTICAÇÃO

A tela inicial deve ser um login simples onde o cliente informa:

- Usuário (campo: usuario)

- Senha (campo: password)

Ao fazer login, chame GET /customers/search/{query} para localizar o cliente pelo usuário digitado, e valide a senha localmente contra o campo "password" retornado. Armazene o token e o objeto do cliente no estado global (Context ou Zustand).

Headers obrigatórios em todas as requisições:

Authorization: Bearer SEU_TOKEN_AQUI

Accept: application/json

Content-Type: application/json

---

## TELA PRINCIPAL — DASHBOARD DO CLIENTE

Após login, exiba um dashboard com as seguintes seções:

### 1. Cabeçalho do perfil

- Nome do cliente, usuário, plano atual (plan.name) e produto (product.name)

- Badge de status: "Ativo" (verde), "Vencido" (vermelho), "Suspendido" (amarelo)

- Data de vencimento destacada com contagem de dias restantes

- Se menos de 7 dias: exibir alerta visual laranja

- Se vencido: exibir alerta vermelho com CTA de renovação

### 2. Cards de resumo (grid 3 colunas)

- Vencimento: data_de_vencimento formatada como dd/mm/yyyy + dias restantes

- Plano: plan.name + plan.value formatado como R$ XX,XX/mês

- Telas: campo "telas" do cliente

### 3. Seção — Renovar acesso

Tabs para selecionar período: 1 mês / 3 meses / 6 meses / 12 meses

(Calcule o valor total com base em plan.value × meses)

Botão "Gerar fatura de renovação":

→ Chama POST /customers/{id}/payment-link

→ Body: { webhook_url: "https://seusite.com/webhook" } (opcional)

→ Exibe o checkout_url retornado em um modal ou redireciona para ele

→ Mostra mensagem de sucesso com link de pagamento copiável

### 4. Seção — Indique e ganhe

- Exibir link de indicação fixo: https://seusite.com/ref/{usuario}

- Botão "Copiar link" (copia para clipboard com feedback visual)

- Botão "Compartilhar no WhatsApp" (abre wa.me com mensagem pré-formatada)

- Mensagem motivacional: "Indique amigos e ganhe dias grátis!"

### 5. Seção — Faturas

Chama: GET /customers/{id}/invoices?per_page=10

Lista cada fatura com:

- Mês/ano da fatura (issuance_date)

- Valor total (total_amount) formatado como R$ XX,XX

- Status com badge colorido:

  - "Pago" → verde

  - "Pendente" / "Em aberto" → amarelo

  - Outros → cinza

- Botão "Pagar" (abre checkout_url) se status pendente

- Botão "Ver fatura" para as pagas

Para gerar nova fatura avulsa: botão "Gerar nova fatura" → POST /customers/{customer}/payment-link

---

## TRATAMENTO DE ERROS E ESTADOS

- Loading skeleton em todas as chamadas de API

- Erro 401: redirecionar para login e limpar sessão

- Erro 429: exibir "Muitas requisições. Aguarde alguns segundos."

- Erro genérico: toast de erro com a mensagem retornada por response.message

- Dados offline: cache local com stale-while-revalidate

---

## DESIGN E UX

- Visual limpo, mobile-first, responsivo

- Paleta: roxo escuro (#3C3489) como cor primária, verde (#0F6E56) para ações de renovação

- Tipografia clara, espaçamento generoso

- Sem scroll horizontal

- Feedback visual em todos os botões (loading state enquanto aguarda API)

- Todas as datas exibidas no formato dd/mm/yyyy (pt-BR)

- Valores monetários com Intl.NumberFormat pt-BR (R$ XX,XX)

---

## STACK SUGERIDA

- React + TypeScript

- TailwindCSS

- React Query (para cache e loading states)

- Zustand (estado global de autenticação)

- React Router (rotas: /login, /dashboard)



## DESIGN E UX — LOREALL PLAY TV

Identidade visual baseada na logo oficial da Loreall Play TV.

### Cores principais

- Primária (ações, botões, destaques): gradiente #00C8FF → #2060FF → #7B2FD4

- Botão sólido principal: background #2060FF, hover #1a50e0

- Acento roxo (badges, links ativos): #7B2FD4

- Texto sobre fundo escuro: #FFFFFF

- Fundo da página: #F4F6FB (claro) ou #0A0A14 (dark mode)

- Cards: fundo branco com borda sutil #E2E8F0

- Status ativo: #00C8FF (ciano)

- Status vencido: #EF4444

- Status pendente: #F59E0B

### Logo

- Exibir a logo "Loreall Play TV" no topo da tela de login e no header do dashboard

- Usar a imagem fornecida (LOREALL_-_PERFIL.png) como src da logo

- Altura da logo no header: 40px

- Altura da logo na tela de login: 80px, centralizada

### Tipografia

- Font: Inter (Google Fonts)

- Títulos: font-weight 700, cor #1E1B4B (dark blue)

- Subtítulos e labels: font-weight 500, cor #6B7280

- Body: font-weight 400

### Botões

- Botão primário: background linear-gradient(135deg, #00C8FF, #7B2FD4), texto branco, border-radius 10px

- Botão secundário: border 1.5px solid #7B2FD4, texto #7B2FD4, fundo transparente

- Hover: brightness(1.1) + scale(1.02)

- Active: scale(0.98)

### Componentes

- Cards com border-radius 16px, sombra sutil box-shadow: 0 2px 12px rgba(0,0,0,0.06)

- Badges de status com pill arredondada (border-radius 20px)

- Header com fundo branco + borda inferior 1px #E2E8F0

- Mobile-first, responsivo, sem scroll horizontal

- Feedback visual em todos os botões (spinner enquanto aguarda API)

- Todas as datas:

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://loreall-client-portal.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c08eb68f-7d8d-4d99-8ed6-0b192663019d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
