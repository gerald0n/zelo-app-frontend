-- Financeiro (doc 104): taxa real do Mercado Pago por transação.
--
-- Na confirmação do Pix a aplicação faz uma chamada extra a
-- `GET /v1/payments/{id}` e grava a taxa (fee) e o líquido (net) reais no
-- pedido, junto com o id do pagamento. Onde não há o número real (Pix antigo,
-- falha na chamada), o relatório estima com `stores.payment_fee_estimate_bps`
-- (basis points; padrão 99 = 0,99%). Dinheiro/cartão na entrega não têm taxa
-- de MP. Estorno não devolve a taxa — o relatório mostra como custo.

alter table public.orders
  add column mp_payment_id text,
  add column payment_fee_cents integer,
  add column payment_net_cents integer,
  add constraint orders_payment_fee_nonneg
    check (payment_fee_cents is null or payment_fee_cents >= 0),
  add constraint orders_payment_net_nonneg
    check (payment_net_cents is null or payment_net_cents >= 0);

alter table public.stores
  add column payment_fee_estimate_bps integer not null default 99
    constraint stores_payment_fee_estimate_range
      check (payment_fee_estimate_bps between 0 and 2000);
