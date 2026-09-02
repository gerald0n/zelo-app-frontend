-- Pix automático via Mercado Pago (Orders API).
--
-- Antes: o cliente pagava num "copia e cola" estático da loja e enviava o
-- comprovante pelo WhatsApp; a confirmação era manual. Agora cada pedido Pix
-- gera uma cobrança dinâmica no Mercado Pago (QR + copia e cola por pedido) e
-- a confirmação chega automaticamente por webhook.

-- ---------------------------------------------------------------------------
-- Colunas da cobrança Pix no pedido
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists mp_order_id text,
  add column if not exists pix_qr_code text,
  add column if not exists pix_qr_code_base64 text,
  add column if not exists pix_ticket_url text,
  add column if not exists pix_expires_at timestamptz,
  add column if not exists paid_at timestamptz;

-- Um pedido ↔ uma ordem do Mercado Pago.
create unique index if not exists orders_mp_order_id_key
  on public.orders (mp_order_id)
  where mp_order_id is not null;

-- Reconciliação: varrer pedidos Pix ainda pendentes.
create index if not exists orders_pix_pending_idx
  on public.orders (payment_status, pix_expires_at)
  where payment_method = 'pix';

-- ---------------------------------------------------------------------------
-- Log bruto das notificações do Mercado Pago (auditoria + idempotência)
-- ---------------------------------------------------------------------------
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'mercadopago',
  event_id text,                 -- id da notificação (body.id / x-request-id)
  event_type text,               -- "payment", "order", ...
  action text,                   -- "payment.created", "payment.updated", ...
  mp_order_id text,
  mp_payment_id text,
  order_id uuid references public.orders (id) on delete set null,
  payload jsonb not null,
  signature_valid boolean not null default false,
  processed_at timestamptz,
  process_result text,
  created_at timestamptz not null default now(),
  constraint payment_events_provider_event_unique unique (provider, event_id)
);

create index if not exists payment_events_order_id_idx
  on public.payment_events (order_id);
create index if not exists payment_events_created_at_idx
  on public.payment_events (created_at desc);

alter table public.payment_events enable row level security;
-- Sem policies para anon/authenticated: acesso apenas via service_role.

grant select, insert, update on public.payment_events to service_role;

-- ---------------------------------------------------------------------------
-- Confirmação de pagamento Pix (chamada pelo webhook, via service_role)
-- ---------------------------------------------------------------------------
create or replace function public.confirm_order_pix_payment(
  p_order_id uuid,
  p_mp_order_id text default null,
  p_paid_at timestamptz default now()
)
returns public.orders
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_order public.orders%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Apenas service_role pode confirmar pagamento';
  end if;

  select * into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if v_order.payment_method <> 'pix' then
    raise exception 'Pedido % não é Pix', p_order_id;
  end if;

  -- Idempotente: notificação repetida não faz nada.
  if v_order.payment_status = 'confirmed' then
    return v_order;
  end if;

  update public.orders o
  set
    payment_status = 'confirmed',
    paid_at = coalesce(o.paid_at, p_paid_at),
    mp_order_id = coalesce(o.mp_order_id, p_mp_order_id),
    updated_at = now()
  where o.id = p_order_id
  returning * into v_order;

  -- Avança o pedido para "confirmed" apenas se ainda estiver em "received"
  -- (o admin pode ter agido antes).
  if v_order.status = 'received' then
    v_order := private.transition_order_status(
      p_order_id,
      'confirmed'::public.order_status,
      'system'::public.status_change_actor_type,
      'Pagamento Pix confirmado'
    );
  end if;

  return v_order;
end;
$$;

revoke all on function public.confirm_order_pix_payment(uuid, text, timestamptz)
  from public;
grant execute on function public.confirm_order_pix_payment(uuid, text, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Falha / expiração de pagamento Pix (webhook ou cron de reconciliação)
-- ---------------------------------------------------------------------------
create or replace function public.fail_order_pix_payment(
  p_order_id uuid,
  p_reason text default 'Pagamento Pix não concluído'
)
returns public.orders
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_order public.orders%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Apenas service_role pode falhar pagamento';
  end if;

  select * into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  -- Já pago: ignora expiração/cancelamento que chegou tarde.
  if v_order.payment_status = 'confirmed' then
    return v_order;
  end if;

  update public.orders o
  set payment_status = 'failed', updated_at = now()
  where o.id = p_order_id
  returning * into v_order;

  -- Cancela o pedido se ele ainda não saiu de "received".
  if v_order.status = 'received' then
    v_order := private.transition_order_status(
      p_order_id,
      'cancelled'::public.order_status,
      'system'::public.status_change_actor_type,
      p_reason
    );
  end if;

  return v_order;
end;
$$;

revoke all on function public.fail_order_pix_payment(uuid, text) from public;
grant execute on function public.fail_order_pix_payment(uuid, text) to service_role;
