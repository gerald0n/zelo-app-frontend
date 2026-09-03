-- Colunas e RPC do estorno Pix (o valor 'refunded' já foi adicionado ao enum
-- na migração anterior — não pode ser usado na mesma transação).

alter table public.orders
  add column if not exists refunded_at timestamptz,
  add column if not exists mp_refund_id text;

-- ---------------------------------------------------------------------------
-- Marca o pagamento Pix como estornado (chamado após o refund na API do MP).
-- ---------------------------------------------------------------------------
create or replace function public.refund_order_pix_payment(
  p_order_id uuid,
  p_mp_refund_id text default null
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
    raise exception 'Apenas service_role pode estornar pagamento';
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

  -- Idempotente.
  if v_order.payment_status = 'refunded' then
    return v_order;
  end if;

  update public.orders o
  set
    payment_status = 'refunded',
    refunded_at = coalesce(o.refunded_at, now()),
    mp_refund_id = coalesce(o.mp_refund_id, p_mp_refund_id),
    updated_at = now()
  where o.id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.refund_order_pix_payment(uuid, text) from public;
grant execute on function public.refund_order_pix_payment(uuid, text) to service_role;
