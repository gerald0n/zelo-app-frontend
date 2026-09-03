-- Estorno de Pix pago + colunas de rastreio.
--
-- Quando o admin cancela um pedido Pix já pago, o valor é devolvido via API do
-- Mercado Pago (POST /v1/orders/{id}/refund). O pedido em si já foi cancelado
-- pela transição normal; aqui só marcamos o pagamento como estornado.

alter type public.payment_status add value if not exists 'refunded';
