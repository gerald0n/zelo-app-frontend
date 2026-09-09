-- 106 Fase 1 — Avaliação do pedido + depoimentos.
--
-- Uma avaliação por pedido entregue: nota 1–5 + comentário opcional. Tudo
-- entra como `pending` e só aparece no site quando o admin aprova E marca
-- como destaque. O nome exibido ("Maria S.") é gravado como snapshot no
-- momento do envio.

create type public.review_status as enum ('pending', 'approved', 'hidden');

create table public.order_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text
    check (
      comment is null
      or char_length(btrim(comment)) between 1 and 1000
    ),
  status public.review_status not null default 'pending',
  is_featured boolean not null default false,
  -- Snapshot "primeiro nome + inicial" no envio; o `customers.name` pode mudar.
  customer_display_name text not null
    check (char_length(btrim(customer_display_name)) between 1 and 80),
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_reviews_order_unique unique (order_id)
);

create index order_reviews_moderation_idx
  on public.order_reviews (status, created_at desc);

create index order_reviews_featured_idx
  on public.order_reviews (moderated_at desc)
  where status = 'approved' and is_featured;

create trigger order_reviews_set_updated_at
  before update on public.order_reviews
  for each row execute function public.set_updated_at();

alter table public.order_reviews enable row level security;

grant select on public.order_reviews to anon, authenticated;
grant select, insert, update, delete on public.order_reviews to authenticated;

-- Vitrine pública: só os aprovados marcados como destaque (viram depoimento).
create policy order_reviews_public_read
  on public.order_reviews for select
  to anon, authenticated
  using (
    private.is_admin()
    or (status = 'approved' and is_featured = true)
  );

-- Moderação: só admin. O painel usa a service role (bypassa RLS); a policy
-- cobre o acesso via `authenticated`.
create policy order_reviews_admin_manage
  on public.order_reviews for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());
