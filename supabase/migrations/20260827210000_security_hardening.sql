-- Endurecimento: rate limit por IP (hash), UPDATE do cliente só no nome.

create table if not exists public.http_rate_limits (
  id bigint generated always as identity primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists http_rate_limits_bucket_created_idx
  on public.http_rate_limits (bucket, created_at desc);

alter table public.http_rate_limits enable row level security;

revoke all on table public.http_rate_limits from anon, authenticated;
grant select, insert, delete on table public.http_rate_limits to service_role;

comment on table public.http_rate_limits is
  'Contadores de rate limit HTTP. bucket é hash, sem IP em claro.';

revoke update on table public.customers from authenticated;
grant update (name, updated_at) on table public.customers to authenticated;
