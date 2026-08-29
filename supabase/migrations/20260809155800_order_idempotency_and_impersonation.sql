-- Fase G: idempotência de pedidos + create_order com impersonação (service_role).
-- Usado pela API com identidade temporária (local/preview) até OTP WhatsApp.

create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  key text not null,
  customer_id uuid references public.customers (id) on delete set null,
  request_hash text not null,
  response_status integer not null,
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  constraint idempotency_keys_scope_key_unique unique (scope, key)
);

create index if not exists idempotency_keys_created_at_idx
  on public.idempotency_keys (created_at desc);

alter table public.idempotency_keys enable row level security;

-- Sem policies para authenticated/anon: acesso apenas via service_role.

create or replace function public.create_order_as_customer(
  p_customer_id uuid,
  payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_order_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Apenas service_role pode impersonar cliente';
  end if;

  if p_customer_id is null then
    raise exception 'customer_id é obrigatório';
  end if;

  if not exists (select 1 from public.customers c where c.id = p_customer_id) then
    raise exception 'Cliente não encontrado';
  end if;

  -- Impersona o cliente para private.create_order (auth.uid()).
  perform set_config('request.jwt.claim.sub', p_customer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_customer_id::text,
      'role', 'authenticated'
    )::text,
    true
  );

  v_order_id := private.create_order(payload);
  return v_order_id;
end;
$$;

revoke all on function public.create_order_as_customer(uuid, jsonb) from public;
grant execute on function public.create_order_as_customer(uuid, jsonb) to service_role;
