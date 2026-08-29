-- RF-047: administrador habilita/desabilita formas de pagamento.
alter table public.stores
  add column if not exists accepts_pix boolean not null default true,
  add column if not exists accepts_cash boolean not null default true,
  add column if not exists accepts_card boolean not null default true;

alter table public.stores
  drop constraint if exists stores_at_least_one_payment;

alter table public.stores
  add constraint stores_at_least_one_payment
  check (accepts_pix or accepts_cash or accepts_card);
