# 104 — Promoções, Cupons e Financeiro

Extraído do `_HANDOFF` em 2026-09-04 — só ler este doc quando for mexer em
promoções, cupons ou financeiro.

## Estado

| Bloco | Status |
| --- | --- |
| Promoções | **Em produção.** |
| Cupons | **Em produção** (2026-09-08 — PR #62). |
| Financeiro | **Em produção** (2026-09-08 — PR #64). |

Migrations `20260908140000_coupons.sql` e `20260908150000_payment_financials.sql`
aplicadas no Supabase remoto; deploys `zelo-app`/`zelo-admin` verdes.

---

## Promoções (implementado)

- Tabela `promotions` (`scope`: `store`/`category`/`products`,
  `discount_percent`, `starts_at`/`ends_at` opcionais, `is_active`) +
  junções `promotion_categories`/`promotion_products`. RLS no padrão
  `categories`/`products`.
- `private.effective_price_cents(price_cents, category_id, product_id)`
  resolve por especificidade (produto > categoria > loja toda, nunca
  acumula) e arredonda por unidade em centavos — chamada dentro de
  `private.create_order` e `private.create_manual_order`, que são a fonte
  de verdade do preço gravado no pedido.
- Catálogo público espelha a mesma resolução em TypeScript
  (`src/modules/catalog/promotions.ts`) só pra exibir preço com desconto —
  carrinho/checkout herdam automaticamente via `CatalogProduct.price`
  (que já vem com desconto aplicado; `originalPrice`/`discountPercent`
  aparecem só quando há desconto ativo, usados pra mostrar preço riscado).
- Admin: aba **Promoções** em `admin/catalogo` — bloqueia duas promoções do
  mesmo nível (mesmo escopo) cobrindo o mesmo alvo no mesmo período.

**Decisões travadas:**
- Uma promoção efetiva por produto, por especificidade: produto > categoria
  > loja toda. Admin bloqueia duas do mesmo nível cobrindo o mesmo alvo.
- Abrangência: loja toda / categorias / produtos. Percentual + período +
  ativa.
- Arredondar por unidade, em centavos.

Migration: `supabase/migrations/20260904170000_promotions.sql`.

---

## Cupons (implementado — 2026-09-08)

**Decisões travadas** (todas seguidas):
- Tipos: percentual, valor fixo, frete grátis.
- Incide sobre subtotal de produtos (não sobre frete; "frete grátis" zera o
  frete).
- Sem acúmulo com promoção: carrinho com item em promoção → cupom recusado.
- Só limite total de usos (sem limite por cliente até o login por SMS —
  Fase 14 do roadmap).
- Uso contado junto com a criação do pedido (atômico); cancelamento devolve.

**Implementação** (migration `20260908140000_coupons.sql`):
- Tabela `public.coupons` (`code` único e uppercase, `discount_type`,
  `discount_value`, `max_uses`, `uses_count`, `is_active`, período opcional).
  RLS admin-only. `orders` ganhou `coupon_id`/`coupon_code`/
  `coupon_discount_cents` e o check `orders_total_consistent` passou a
  descontar o cupom.
- `private.claim_coupon(code, subtotal, delivery_fee, has_promo)` — trava a
  linha (`for update`), valida (ativo, período, `uses_count < max_uses`,
  sem promo) e **incrementa `uses_count` na mesma transação**; lança em
  qualquer problema, abortando a criação do pedido. Chamada dentro de
  `private.create_order` **e** `private.create_manual_order`.
- `has_promo` = algum item com `effective_price_cents < price_cents`.
- Desconto (`private.coupon_discount_cents`): percent = `round(subtotal *
  v/100)` capado no subtotal; fixed = `min(v, subtotal)`; free_shipping =
  a taxa de entrega. `total = subtotal + adicionais + frete − desconto`.
- `private.transition_order_status`: ao cancelar, `uses_count = greatest(
  uses_count - 1, 0)` se o pedido tinha cupom.
- `public.preview_coupon(code, subtotal, delivery_fee, product_ids[])` —
  read-only (não conta uso, resolve `has_promo` sozinha pelos produtos),
  retorna `{ valid, code, discountType, discountCents }` ou
  `{ valid: false, reason }`. Só pro checkout mostrar o desconto antes.

**Front:**
- Cliente: campo de cupom na revisão do checkout
  (`checkout/revisao/_components/CouponField` + `OrderTotals`), chama
  `POST /api/v1/coupons/preview`; o código vai no body do pedido como
  `couponCode`.
- Comanda manual (`/pedidos/novo`): campo "Cupom (opcional)" na etapa de
  pagamento.
- Admin: aba **Cupons** em `/catalogo` (`CouponsTab`), CRUD via
  `POST/PATCH/DELETE /api/v1/admin/coupons`, lista com `usos X/Y`. O detalhe
  do pedido (modal do kanban) mostra a linha "Cupom … −R$ X".
- Falta (follow-up): mostrar o cupom no acompanhamento do cliente e no
  comprovante térmico.

**Testado 2026-09-08** (Supabase local, rotas HTTP reais): CRUD admin
(uppercase, código duplicado → 400, % fora de 1–100 → 400); comanda manual
com cupom (10% em R$16 → R$14,40, `uses_count` +1); cancelar devolve o uso;
promoção ativa → `preview` e criação recusam ("não acumula"), sem contar
uso; `preview` free_shipping e "não encontrado".

---

## Financeiro (implementado — 2026-09-08)

**Decisões travadas** (todas seguidas):
- Taxa real do Mercado Pago, gravada por transação (1 chamada extra ao MP na
  confirmação do Pix): grava taxa (R$) e líquido (R$) no pedido.
- Campo configurável de taxa (padrão 0,99%) só pra estimar onde não há o
  número real.
- Estorno não devolve a taxa — relatório mostra como custo.
- Dinheiro/cartão na entrega: separados (sem taxa MP).
- Aba "Financeiro" própria no admin.

**Implementação** (migration `20260908150000_payment_financials.sql`):
- `orders` ganhou `mp_payment_id`, `payment_fee_cents`, `payment_net_cents`
  (nullable). `stores` ganhou `payment_fee_estimate_bps` (basis points;
  padrão 99 = 0,99%), editável em **Ajustes → Geral** ("Taxa de pagamento
  estimada (%)").
- Na confirmação do Pix (`order-pix-webhook.ts` → `applyStatus` →
  `recordPaymentFinancials`, e também no `order-pix-reconcile`): 1 chamada a
  `GET /v1/payments/{id}`. `paymentFinancials()` soma `fee_details` (taxas do
  vendedor) e lê `transaction_details.net_received_amount` (fallback:
  bruto − taxa). Falha aqui é silenciosa — o relatório cai na estimativa.
- **Relatório** (`src/modules/admin/financial-report.ts` →
  `GET /api/v1/admin/reports?kind=financial&period=`): por período —
  bruto faturado, taxas MP (real quando tem, estimativa `round(total *
  bps/10000)` quando não), líquido; split por forma de pagamento (Pix /
  dinheiro / cartão — só Pix tem taxa); estornos (nº, valor devolvido, taxa
  não recuperada como custo); lista de transações Pix (bruto / taxa /
  líquido, marca "taxa estimada" quando não veio do MP).
  - "Faturado" = Pix `confirmed` + dinheiro/cartão não cancelado. Pix
    pendente/falho e cancelados ficam de fora.
- **UI**: toggle **Operação | Financeiro** no topo de `/relatorios` (reusa o
  seletor de período). Views em `relatorios/_components/`.

**Testado 2026-09-08** (Supabase local, dados sintéticos): bruto R$100 (2 Pix
confirmados + 1 dinheiro), taxas R$0,80 (R$0,50 real + R$0,30 estimado a
0,99%), líquido R$99,20; split por método certo; 1 estorno → R$40 devolvido +
R$0,40 de taxa não recuperada; lista Pix com marca de estimada. Config da
taxa via PATCH da loja OK.

**Follow-up:** a taxa real do MP (`fee_details` / `net_received_amount`) só é
validável de verdade num Pix de produção — até o primeiro pagamento real
todas as transações Pix aparecem com a taxa estimada.
