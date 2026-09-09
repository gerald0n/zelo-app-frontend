-- Avaliação de produto — nota 1–5 + comentário opcional, uma por cliente por
-- produto. Só quem tem um pedido ENTREGUE contendo o produto pode avaliar
-- (checado na aplicação). Tudo entra como `pending` e só aparece no site
-- depois que o admin aprova. Reaproveita o enum `review_status`.

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  -- Pedido entregue que habilitou a avaliação (some se o pedido for apagado).
  order_id uuid references public.orders (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text
    check (
      comment is null
      or char_length(btrim(comment)) between 1 and 1000
    ),
  status public.review_status not null default 'pending',
  -- Snapshot "primeiro nome + inicial" no envio; o `customers.name` pode mudar.
  customer_display_name text not null
    check (char_length(btrim(customer_display_name)) between 1 and 80),
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_reviews_customer_product_unique unique (product_id, customer_id)
);

create index product_reviews_moderation_idx
  on public.product_reviews (status, created_at desc);

create index product_reviews_product_approved_idx
  on public.product_reviews (product_id, created_at desc)
  where status = 'approved';

create trigger product_reviews_set_updated_at
  before update on public.product_reviews
  for each row execute function public.set_updated_at();

alter table public.product_reviews enable row level security;

grant select on public.product_reviews to anon, authenticated;
grant select, insert, update, delete on public.product_reviews to authenticated;

-- Vitrine pública: só os aprovados (o admin vê tudo).
create policy product_reviews_public_read
  on public.product_reviews for select
  to anon, authenticated
  using (
    private.is_admin()
    or status = 'approved'
  );

-- Moderação: só admin. O painel usa a service role (bypassa RLS); a policy
-- cobre o acesso via `authenticated`. O envio do cliente também passa pela
-- service role, depois de checar posse + pedido entregue na aplicação.
create policy product_reviews_admin_manage
  on public.product_reviews for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());
