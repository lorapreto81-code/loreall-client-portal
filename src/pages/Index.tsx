import { Copy, Terminal, ExternalLink, Zap, Gift, Bot, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ApiDocs = () => {
  const [copied, setCopied] = useState(false);

  const fullSpec = `# API REST TopGestor v1 - Especificação para LLMs

## Informações Gerais
- Base URL: https://topgestor.me/api/v1
- Autenticação: Bearer Token (Laravel Sanctum)
- Header obrigatório: Authorization: Bearer SEU_TOKEN
- Tokens devem ser gerados no painel em Configurações > API Tokens. A API v1 não possui login público por email e senha.
- Header obrigatório: Accept: application/json
- Content-Type: application/json (para POST/PUT)
- Rate Limit: Sim (429 Too Many Requests)
- Paginação: ?per_page=15&page=1 (máximo 100 por página)

## Formato de Resposta Padrão
Sucesso: { "success": true, "data": {...}, "message": "..." }
Erro: { "success": false, "message": "Descrição do erro." }
Lista paginada inclui: "meta": { "current_page": 1, "last_page": 10, "per_page": 15, "total": 150 }

---

## ENDPOINTS DE AUTENTICAÇÃO

### GET /auth/me
Retorna usuário autenticado e empresa.
Resposta: { success, data: { user{id,name,email,whatsapp,profile_photo_url}, company{id,name,status,plan,due_date,credits} } }

### POST /auth/logout
Revoga o token atual.

---

## ENDPOINTS DE CLIENTES

### GET /me
Retorna dados da empresa autenticada: company_id, company_name, email, whatsapp, plan, status, credits, due_date, customers{total, ativos, vencidos}. Se houver sub-revendas, inclui resellers{total, ativos, vencidos, em_teste}.

### GET /dashboard
Retorna métricas agregadas: clientes_ativos, clientes_vencidos, clientes_vencendo, total_clientes, novos_mes, novos_mes_anterior, receita_mes, receita_mes_anterior, faturas_pendentes, total_pendente, weekly_revenue e period.

### GET /customers
Lista clientes paginados.
Query params: per_page (int, max 100), page (int), status (ativo|vencido), search (string: nome, usuario, whatsapp, email, cpf_cnpj), archived (bool)
Resposta: Lista de clientes com id, name, usuario, password, whatsapp, email, status, data_de_vencimento, telas, product{id,name}, plan{id,name,value}

### GET /customers/{id}
Retorna dados completos de um cliente.
Campos: id, name, usuario, password, whatsapp, whatsapp_secondary, email, cpf_cnpj, key, mac, devices, telas, external_id, iptv_provider, iptv_auto_renew_enabled, data_de_vencimento, data_vencimento_app, data_aniversario, status, desconto, desconto_recorrente, vencimento_fixo, observacao, anotation, forma_captacao, forma_captacao_personalizada, is_archived, product{id,name,value,iptv_provider}, plan{id,name,value,qtd_meses}, app{id,name,value}, accesses[], created_at, updated_at

### POST /customers
Cria um novo cliente.
Body obrigatório: name (string), usuario (string), password (string), product_id (int), plan_id (int), data_de_vencimento (YYYY-MM-DD)
Body opcional: whatsapp, whatsapp_secondary, email, cpf_cnpj, app_id, telas (int, default 1), key, mac, devices, observacao, desconto (number), desconto_recorrente (bool), vencimento_fixo (bool), iptv_auto_renew_enabled (bool; aliases aceitos: auto_renew_enabled, renovacao_automatica), data_aniversario (YYYY-MM-DD), data_vencimento_app (YYYY-MM-DD), forma_captacao (string), lembretes (bool), reminder_category_ids (array), billing_config_ids (array), webhook_url (string, HTTPS)
Cobranças no cadastro: billing_config_ids tem prioridade sobre reminder_category_ids; reminder_category_ids tem prioridade sobre lembretes. lembretes=true ativa todas as cobranças da empresa; lembretes=false remove vínculos.
Resposta 201: { success: true, message: "Cliente cadastrado com sucesso.", data: {id, name, usuario, status, data_de_vencimento} }

### PUT /customers/{id}
Atualiza um cliente existente. Todos os campos são opcionais. Mesmos campos do POST. Para renovação automática IPTV use iptv_auto_renew_enabled (bool); aliases aceitos: auto_renew_enabled, renovacao_automatica. Também aceita lembretes, reminder_category_ids e billing_config_ids para sincronizar cobranças.
Resposta 200: { success: true, message: "Cliente atualizado com sucesso.", data: {...} }

### DELETE /customers/{id}
Remove um cliente. Ação irreversível.
Body opcional: webhook_url (HTTPS)
Resposta 200: { success: true, message: "Cliente removido com sucesso." }

### GET /customers/search/{query}
Busca clientes por nome, usuário ou WhatsApp.
Query params: per_page (int, max 100). Resposta: Lista paginada de clientes.

### POST /customers/{id}/renew
Renova um cliente (fluxo completo: venda financeira + fatura + renovação no provedor + pontos fidelidade).
Body opcional: plan_id (int), dias (int 1-365), data_de_vencimento (YYYY-MM-DD futura), invoice_status (Pago|Pendente|Em aberto, default Pago), renew_iptv (bool, default true), send_whatsapp (bool, default false), message_id (int), webhook_url (HTTPS)
Resposta 200: { success: true, data: {id, name, status, data_de_vencimento}, meta: {data_anterior, nova_data_vencimento, desarquivado, cliente_recuperado, venda_id, invoice_status, iptv: {renovado, mensagem}, pontos, whatsapp} }

---

## ENDPOINTS DE FATURAS

### GET /invoices
Lista todas as faturas da empresa.
Query params: per_page (int, max 100, default 20), page (int), status (Pago|Em aberto|Cancelado|Pendente), search (nome ou WhatsApp do cliente)
Resposta inclui stats: { pago, em_aberto, cancelado }

### GET /customers/{customer}/invoices
Lista faturas de um cliente. Query params: per_page (int), status (string).
Campos: id, customer_id, status, amount, desconto, total_amount, issuance_date, due_date, info, checkout_url, product{id,name,value}, plan{id,name,value}

### GET /invoices/{id}
Retorna dados de uma fatura específica.

### POST /customers/{customer}/payment-link
Gera fatura (se não existir em aberto) e retorna link de pagamento.
Body opcional: webhook_url (string HTTPS)
Resposta: { data: { invoice: {...}, checkout_url: "https://...", fatura_gerada: true|false } }

### GET /invoices/{invoice}/checkout-url
Retorna apenas a URL de checkout: { data: { invoice_id, status, checkout_url } }

### DELETE /invoices/{invoice}
Remove uma fatura. Ação irreversível.
Body opcional: webhook_url (HTTPS). Não permite excluir faturas pagas.

---

## ENDPOINTS DE PLANOS

### GET /plans
Lista todos os planos: [{ id, plan_name, plan_value, plan_description, qtd_meses, for_meses }]

---

## ENDPOINTS DE PRODUTOS

### GET /products
Lista produtos/servidores da empresa: [{ id, product_name, product_value, product_description, credits, iptv_provider }]

---

## ENDPOINTS DE COBRANÇAS / LEMBRETES

### GET /billing-configs
Lista configurações de cobrança/lembretes da empresa.
Resposta: [{ id, template_message_id, template_name, send_days, send_time, send_days_offset, reminder_type }]

### GET /reminder-categories
Lista categorias de lembrete (grupos de cobranças).
Resposta: [{ id, name, billing_config_ids }]

---

## ENDPOINTS DE MENSAGENS

### GET /messages
Lista templates WhatsApp: [{ id, name, message, is_default }]
Tags: {{customer_name}}, {{customer_first_name}}, {{customer_usuario}}, {{customer_password}}, {{customer_duedate}}, {{customer_duedate_sh}}, {{customer_plan}}, {{customer_plan_value}}, {{customer_product}}, {{company_name}}, {{customer_invoice_link}}, {{customer_invoice_pdf}}

---

## ENDPOINTS DE REVENDEDORES

Disponíveis somente para contas Revendedor/admin.

### GET /resellers
Lista sub-revendedores. Query params: per_page (int, max 100)

### POST /resellers
Cria sub-revendedor.
Body obrigatório: name, email, whatsapp, password (min 8), tipo (Teste|Oficial), plan_value (number min 37)
Body opcional: creditos (obrigatório se tipo=Oficial), webhook_url

### POST /resellers/{id}/renew
Renova sub-revendedor. Body obrigatório: creditos (int min 1). Body opcional: webhook_url.

### GET /resellers/search/{query}
Busca sub-revendedores por nome, email ou WhatsApp. Query params: per_page.`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullSpec);
    setCopied(true);
    toast.success("Especificação copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-300 font-sans p-6 md:p-12 max-w-5xl mx-auto">
      <header className="mb-12 border-b border-slate-800 pb-8">
        <div className="flex items-center gap-3 mb-4">
          <Terminal className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-black text-white tracking-tight">API para IAs e LLMs</h1>
        </div>
        <p className="text-lg text-slate-400 max-w-2xl leading-relaxed">
          Copie e cole esta especificação completa para ensinar IAs (ChatGPT, Claude, Gemini) sobre a API do TopGestor e criar integrações personalizadas.
        </p>
      </header>

      <div className="grid gap-8">
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-white">Como usar com IAs</h2>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar Especificação"}
            </button>
          </div>
          
          <div className="relative group">
            <div className="absolute inset-0 bg-primary/5 blur-xl group-hover:bg-primary/10 transition-colors pointer-events-none" />
            <pre className="relative bg-black/40 rounded-xl p-6 overflow-x-auto text-xs md:text-sm font-mono leading-relaxed border border-white/5 scrollbar-thin scrollbar-thumb-slate-700">
              {fullSpec}
            </pre>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-amber-400" />
              <h3 className="font-bold text-white">N8N / Make</h3>
            </div>
            <p className="text-sm leading-relaxed mb-4">
              "Crie um workflow que ao receber um pagamento confirmado, renove o cliente automaticamente na API do TopGestor."
            </p>
            <a href="https://docs.topgestor.me" target="_blank" className="text-primary text-xs font-bold inline-flex items-center gap-1 hover:underline">
              Ver docs oficial <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="h-5 w-5 text-emerald-400" />
              <h3 className="font-bold text-white">BotConversa</h3>
            </div>
            <p className="text-sm leading-relaxed mb-4">
              "Quando o cliente digitar 'pagar', busque o WhatsApp na API e envie o link de checkout gerado."
            </p>
            <p className="text-xs text-slate-500 italic">Dica: Use os campos de "accesses" para suporte avançado.</p>
          </div>
        </section>
      </div>

      <footer className="mt-20 pt-8 border-t border-slate-800 text-center">
        <p className="text-xs text-slate-500 font-medium">
          Atenção! Use esta especificação para ajustar a área do cliente e entender melhor o fluxo da API.
        </p>
      </footer>
    </div>
  );
};

export default ApiDocs;
