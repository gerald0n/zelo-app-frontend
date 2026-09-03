-- `refunded` é estado terminal de pagamento.
--
-- Quando o admin estorna um Pix pago, o Mercado Pago dispara um webhook com a
-- ordem em status `refunded`. Nosso normalizador mapeia isso para `refunded`, e
-- antes desta migração o webhook de falha (`fail_order_pix_payment`) só protegia
-- `payment_status = 'confirmed'` — então a notificação pós-estorno rebaixava o
-- pedido de `refunded` para `failed`, e o selo do admin voltava de "Estornado"
-- para "Não pago". Aqui `refunded` passa a ser tratado como terminal nas duas
-- RPCs (nada de ressuscitar para `confirmed` nem rebaixar para `failed`).

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

  -- Estados terminais: notificação repetida ou fora de ordem não faz nada.
  if v_order.payment_status in ('confirmed', 'refunded') then
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

  -- Estados terminais de pagamento: ignora expiração/cancelamento/estorno que
  -- chegou tarde (inclusive o webhook que o próprio estorno dispara).
  if v_order.payment_status in ('confirmed', 'refunded') then
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
