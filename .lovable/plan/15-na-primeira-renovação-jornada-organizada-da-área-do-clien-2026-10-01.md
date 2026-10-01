# 15% na primeira renovação + jornada organizada da área do cliente

## Parte 1 — 15% OFF na primeira renovação (1 vez só)

**Regra**
- Vale para todos os planos (1, 3, 6 e 12 meses), só para PIX gerado **dentro da área do cliente**.
- Só 1 vez por cliente: depois que um PIX com esse desconto é **pago**, o desconto some para sempre. PIX abandonado não gasta o benefício.
- Não vale no link direto de renovação nem no PIX Automático (podemos liberar depois).
- Não soma com cupom: se o cliente digitar um cupom, vale o que der o **maior** desconto.
- Liga/desliga pelo painel Admin (Cupons de Desconto → "Desconto de primeira renovação"), com a porcentagem editável (padrão 15%).

**O que o cliente vê**
- Na escolha de planos: preço antigo riscado, preço com 15% e selo "15% OFF · 1ª renovação".
- Botão de pagar já mostra o valor com desconto.
- Banner da promoção (a imagem enviada) aparece na área do cliente enquanto o cliente ainda tem o benefício — some depois de usado.

**Segurança**
- O servidor decide se o cliente tem direito e recalcula o valor na hora de gerar o PIX; o navegador nunca define o preço.

## Parte 2 — Jornada do cliente: 1 prioridade por vez

O sistema escolhe **um único destaque principal** de acordo com a situação do cliente:

```text
1. Acesso vencido        -> card "Seu acesso precisa ser renovado" + RENOVAR
2. Vence em até 3 dias   -> card de vencimento + RENOVAR
3. Sem e-mail / WhatsApp -> card "Complete seus dados" (dispensável)
4. Promoção 15%          -> banner da promoção
5. Normal                -> nada extra
```

- Vencido ou vencendo + sem e-mail: primeiro só a renovação. O pedido de e-mail aparece **depois** do pagamento ou em outra visita.
- Pop-ups automáticos: no máximo **1 por visita** (vencimento tem prioridade; a tela "Minha conta" não abre mais sozinha se o pop-up de vencimento já apareceu).
- Pedido de e-mail: botão "Agora não" esconde por 3 dias; depois de salvo, nunca mais aparece.
- Banner de promoção nunca aparece junto com um alerta de vencimento.
- Aviso do Admin continua no topo (é comunicado seu, sempre visível quando ativo).
- Card do plano, Indique e ganhe e Suporte continuam iguais.

## Detalhes técnicos
- `system_config`: chaves `first_renewal_discount_enabled` e `first_renewal_discount_percent`.
- Novo helper `_shared/firstRenewal.ts`: elegível se não houver `payments` pago com `metadata.first_renewal=true` para o `customer_id` e a sessão for `full` (não checkout).
- `create-pix`: aplica `max(cupom, 1ª renovação)`; grava `metadata.first_renewal`.
- Nova action em `payments`/`area-pricing` (ou `payment-status`) retornando `{ eligible, percent }` para a UI.
- `RenewalBottomSheet`: exibe preço riscado + selo quando elegível e scope=full.
- Banner: imagem enviada via Lovable Assets.
- Novo hook `useCustomerJourney` com a ordem de prioridade acima; `Dashboard`, `DashboardBanners` e `ExpirationPopup` consomem a decisão (dismiss em localStorage com expiração).
- Sem mudanças em renovação TopGestor, webhooks ou lembretes.
