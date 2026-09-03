-- Tentativas de cobrança Pix por pedido.
--
-- Quando o código Pix expira (30 min) sem pagamento, o cliente pode gerar um
-- novo na tela de pagamento. Cada geração é uma nova ordem no Mercado Pago; o
-- contador entra na `X-Idempotency-Key` (`order-<id>-<attempt>`) para que o
-- reenvio da mesma tentativa não duplique a cobrança.
alter table public.orders
  add column if not exists pix_attempt smallint not null default 1;
