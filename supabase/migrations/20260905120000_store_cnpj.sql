-- CNPJ da loja (dado do MEI), usado no cabeçalho do comprovante impresso
-- ("pedido") pro entregador/cliente. Nullable — nem toda sessão de
-- desenvolvimento tem esse dado preenchido, e não bloqueia nada além da
-- impressão térmica.

alter table public.stores
  add column if not exists cnpj text;
