# Plano de Implementação - Refatoração de Assinaturas e Recorrência SyncPay

Analisei a documentação oficial da SyncPay, incluindo o índice completo da API e o núcleo de Assinaturas/Recorrência. A documentação atual foi modificada em agosto de 2026 em vários pontos, então vale mesmo corrigir o Lovable com base nela, e não em uma implementação antiga.

O que está acontecendo na arquitetura da SyncPay

A SyncPay trabalha com quatro conceitos que o seu sistema precisa manter separados:

1. Plano
É o produto recorrente: valor, periodicidade, método de cobrança, tolerância de atraso e tentativas. O billing_method é obrigatório e não pode ser alterado depois da criação. Há dois métodos documentados: qr_code e pix_automatico.

2. Assinatura
É o vínculo de um cliente com um plano. Ela possui um subscription_token, status, próxima cobrança, histórico e dados do assinante.

3. Cobrança/ciclo
Cada ciclo possui cycle_number, valor, vencimento, expiração, status e dados de pagamento. Os estados de cobrança documentados são pending, paid, expired e failed.

4. Mandato do Pix Automático
É outro objeto do fluxo. No Pix Automático, o cliente primeiro precisa autorizar o mandato; a resposta do enroll traz mandate_id, qr_code e mandate_status. Portanto, criar a assinatura não significa automaticamente que o cliente já está ativo.

O ponto mais importante para o seu problema

No POST /api/partner/v1/subscription-plans/{token}/enroll, existem dois comportamentos diferentes:

Para qr_code, a SyncPay retorna a cobrança inicial com pix_code, e a assinatura fica active somente depois da confirmação do primeiro pagamento, através das notificações.

Para pix_automatico, o retorno é de mandato, e o sistema precisa acompanhar o estado da autorização até ACTIVE.

Então o seu sistema não deve fazer isso:

enroll retornou 201 → cliente ativo

Ele precisa fazer:

enroll → salvar subscription_token → salvar estado inicial → aguardar evento/status SyncPay → atualizar assinatura interna → liberar ou bloquear acesso

Esse é provavelmente um dos pontos que estão causando inconsistência na sua implementação.

Outro ponto crítico: webhooks

A SyncPay possui eventos de assinatura como:

assinatura_ativada
assinatura_em_atraso
assinatura_suspensa
assinatura_cancelada
assinatura_reativada

e também pode usar all. O endpoint receptor precisa responder 2xx em até 10 segundos.

A documentação também fornece um envelope de webhook contendo event, subscription_token, plan_token, valor, assinante, status, próxima cobrança e outros dados.

Além disso, existe uma API para consultar as entregas de um webhook e verificar attempt, status, http_code, response_body e sent_at. Isso é excelente para diagnosticar exatamente por que seu webhook não está sincronizando.

Estados que o banco do seu sistema precisa entender

A SyncPay documenta:

pending_first_payment → aguardando primeira cobrança
active → assinatura ativa
overdue → atraso dentro do grace period
suspended → suspensa
cancelled → cancelada definitivamente.

Eu recomendo fortemente que o Lovable não misture esses estados com o estado de acesso do seu cliente.

Exemplo:

syncpay_subscription_status = overdue
access_status = grace_period

ou:

syncpay_subscription_status = active
access_status = active

Isso evita que uma mudança futura no gateway quebre a lógica de acesso do seu sistema.

A própria SyncPay já controla a recorrência

Outro ponto importante: você não deve criar um cron no Lovable para cobrar novamente todo mês, como se a sua aplicação fosse o gateway.

O plano possui:

periodicity_days
billing_advance_days
grace_period_days
max_retry_attempts

e a própria SyncPay administra os ciclos da assinatura.

Sua aplicação deve sincronizar o estado, não tentar reproduzir o motor de recorrência da SyncPay.

Operações disponíveis

A estrutura oficial permite:

POST /subscription-plans → criar plano
GET /subscription-plans → listar
GET /subscription-plans/{token} → detalhes
PATCH /subscription-plans/{token} → editar
DELETE /subscription-plans/{token} → arquivar
GET /subscription-plans/{token}/subscribers → assinantes do plano
POST /subscription-plans/{token}/enroll → cadastrar/enrolar assinante
GET /subscriptions → listar assinaturas
GET /subscriptions/{token} → detalhe completo
PATCH /subscriptions/{token}/cancel → cancelar
PATCH /subscriptions/{token}/suspend → pausar
PATCH /subscriptions/{token}/reactivate → reativar
PATCH /subscriptions/{token}/resend-charge → reenviar cobrança
PATCH /subscriptions/{token}/change-plan → trocar plano.

Um detalhe interessante: arquivar um plano não cancela as assinaturas existentes. Elas continuam funcionando até serem canceladas.

Na troca de plano, a própria SyncPay também possui regras específicas: upgrade gera pró-rata, downgrade fica para o próximo ciclo e planos precisam ser do mesmo produto e do mesmo billing_method.

Token da API

O token Bearer dura 1 hora. A própria documentação orienta a gerar um novo somente quando o anterior expirar. Portanto o Lovable não deve gerar um token novo a cada request. Deve manter/cachear o token no backend e renová-lo quando necessário.

Também é fundamental que client_secret, credenciais da SyncPay e Bearer Token nunca sejam expostos no frontend.

Prompt completo para colocar no Lovable

Abaixo está o prompt que eu usaria no seu projeto. Ele foi estruturado para o Lovable auditar primeiro o que já existe, em vez de simplesmente criar outra implementação por cima da atual.


Minha leitura do problema atual

Pelo que a documentação mostra, eu não trataria o problema como apenas um bug no syncpay-subscribe. A função pode até estar com erro no /enroll, mas a arquitetura precisa garantir que depois do /enroll o sistema continue corretamente até o webhook, a atualização da assinatura e a liberação do acesso.

A maior fonte potencial de erro é justamente confundir “assinatura criada” com “assinatura paga/ativa”, especialmente no Pix Automático.

Também vale atenção ao fato de que a documentação atualizada em 11 de agosto de 2026 já possui a consulta de entregas dos webhooks, então o Lovable deve usar isso para diagnóstico em vez de depender somente dos logs da sua Edge Function.

Esse prompt já está estruturado para o Lovable primeiro auditar o que você tem e depois corrigir, evitando que ele simplesmente coloque uma segunda implementação de recorrência por cima da atual.
