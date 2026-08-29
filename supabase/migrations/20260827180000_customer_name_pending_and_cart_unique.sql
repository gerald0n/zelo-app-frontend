-- Nome do Cliente pode ficar vazio até o primeiro preenchimento após o OTP.
-- Pedido continua exigindo nome no servidor.
-- Um Carrinho persistido por Cliente autenticado.

alter table public.customers
  drop constraint if exists customers_name_not_empty;

alter table public.customer_otp_challenges
  drop constraint if exists customer_otp_challenges_name_not_empty;

alter table public.customer_otp_challenges
  alter column name set default '';

comment on column public.customers.name is
  'Nome de exibição. Vazio até o Cliente informar; obrigatório para criar Pedido.';

delete from public.carts c
where c.customer_id is not null
  and c.id not in (
    select distinct on (customer_id) id
    from public.carts
    where customer_id is not null
    order by customer_id, updated_at desc
  );

create unique index if not exists carts_one_per_customer_idx
  on public.carts (customer_id)
  where customer_id is not null;
