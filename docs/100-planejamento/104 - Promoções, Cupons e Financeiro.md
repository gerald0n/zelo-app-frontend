# 104 — Promoções, Cupons e Financeiro

Extraído do `_HANDOFF` em 2026-09-04 — só ler este doc quando for mexer em
promoções, cupons ou financeiro.

## Estado

| Bloco | Status |
| --- | --- |
| Promoções | **Implementado.** |
| Cupons | Não iniciado. Decisões já travadas (ver abaixo). |
| Financeiro | Não iniciado. Decisões já travadas (ver abaixo). |

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

## Cupons (não implementado)

**Decisões travadas:**
- Tipos: percentual, valor fixo, frete grátis.
- Incide sobre subtotal de produtos (não sobre frete; "frete grátis" zera o
  frete).
- Sem acúmulo com promoção: carrinho com item em promoção → cupom recusado.
- Só limite total de usos (sem limite por cliente até o login por SMS —
  Fase 14 do roadmap).
- Uso contado junto com a criação do pedido (atômico); cancelamento devolve.

---

## Financeiro (não implementado)

**Decisões travadas:**
- Taxa real do Mercado Pago, gravada por transação (1 chamada extra ao MP na
  confirmação do Pix): grava taxa (R$) e líquido (R$) no pedido.
- Campo configurável de taxa (padrão 0,99%) só pra estimar onde não há o
  número real.
- Estorno não devolve a taxa — relatório mostra como custo.
- Dinheiro/cartão na entrega: separados (sem taxa MP).
- Aba "Financeiro" própria no admin.

Contexto: `orders.mp_order_id`; `payment_events` guarda o payload completo
do MP em jsonb, mas o código não extrai a taxa ainda. Estorno já existe
(`refundOrderPixPayment`).
