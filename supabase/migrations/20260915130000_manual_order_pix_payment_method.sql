-- Novo valor de payment_method para Pix confirmado manualmente na comanda
-- (distinto do 'pix' automático via Mercado Pago — sem QR code/webhook).
-- ALTER TYPE ... ADD VALUE sozinho no arquivo: não pode dividir transação
-- com outro DDL que já use o valor novo (ver 20260903140000_pix_refund.sql).
alter type public.payment_method add value if not exists 'pix_manual';
