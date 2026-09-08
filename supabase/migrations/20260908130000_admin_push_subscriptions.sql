-- Web Push do painel: notificação de pedido novo mesmo com o painel fechado.
--
-- Tabela separada da `push_subscriptions` do cliente (que exige `customer_id`).
-- Uma linha por aparelho/navegador do admin. As rotas do painel usam a
-- service role (bypassa RLS); a policy cobre o acesso via `authenticated`.

create table public.admin_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admin_profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_push_subscriptions_endpoint_unique unique (endpoint)
);

create index admin_push_subscriptions_active_idx
  on public.admin_push_subscriptions (admin_id, revoked_at);

create trigger admin_push_subscriptions_set_updated_at
  before update on public.admin_push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.admin_push_subscriptions enable row level security;

grant select, insert, update, delete
  on public.admin_push_subscriptions to authenticated;

create policy admin_push_subscriptions_admin_all
  on public.admin_push_subscriptions for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());
