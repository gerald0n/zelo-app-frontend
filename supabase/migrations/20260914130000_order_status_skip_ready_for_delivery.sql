-- Delivery pula "Pronto para entrega" (ready_for_delivery) no fluxo real, não
-- só na coluna do quadro. O painel já fundia as duas etapas numa única coluna
-- visual ("Saiu para entrega"), mas a máquina de status continuava exigindo
-- dois avanços (in_production → ready_for_delivery → out_for_delivery) — o
-- card entrava na coluna, ficava parado ali e só saía no segundo clique,
-- dando a impressão de "passar duas vezes" pela mesma coluna.
--
-- Agora `in_production → out_for_delivery` também é uma transição válida:
-- pedidos novos de delivery pulam a etapa intermediária direto. A transição
-- `in_production → ready_for_delivery` e `ready_for_delivery → out_for_delivery`
-- continuam permitidas (não removidas) só para os pedidos que já estejam
-- parados em `ready_for_delivery` no momento deste deploy — eles continuam
-- avançando normalmente até serem entregues. O enum `order_status` não muda.
--
-- Corpo idêntico ao de 20260908140000_coupons.sql, alterando só o ramo
-- `when 'in_production'` do `v_allowed`.
create or replace function private.transition_order_status(
  p_order_id uuid,
  p_new_status order_status,
  p_actor_type status_change_actor_type,
  p_reason text default null::text
)
returns orders
language plpgsql
security definer
set search_path to 'public', 'private', 'extensions'
as $function$
declare
  v_order public.orders%rowtype;
  v_previous public.order_status;
  v_actor_id uuid := auth.uid();
  v_allowed boolean := false;
begin
  if p_new_status is null then
    raise exception 'new_status é obrigatório';
  end if;

  select * into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  v_previous := v_order.status;

  if p_actor_type = 'admin' then
    if not private.is_admin() then
      raise exception 'Somente administrador pode alterar status como admin';
    end if;
  elsif p_actor_type = 'customer' then
    if v_actor_id is null or v_order.customer_id <> v_actor_id then
      raise exception 'Cliente não autorizado para este pedido';
    end if;
    if p_new_status <> 'cancelled'
       or v_previous not in ('received', 'confirmed', 'in_production') then
      raise exception 'Cliente não pode realizar esta transição';
    end if;
  elsif p_actor_type = 'system' then
    null;
  else
    raise exception 'actor_type inválido';
  end if;

  if v_previous = p_new_status then
    raise exception 'Pedido já está em %', p_new_status;
  end if;

  v_allowed := case v_previous
    when 'received' then
      p_new_status in ('confirmed', 'cancelled')
    when 'confirmed' then
      p_new_status in ('in_production', 'cancelled')
    when 'in_production' then
      p_new_status in ('ready_for_delivery', 'ready_for_pickup', 'out_for_delivery', 'cancelled')
    when 'ready_for_delivery' then
      p_new_status in ('out_for_delivery', 'cancelled')
    when 'ready_for_pickup' then
      p_new_status in ('delivered', 'cancelled')
    when 'out_for_delivery' then
      p_new_status in ('delivered', 'cancelled')
    else
      false
  end;

  if not v_allowed then
    raise exception 'Transição inválida: % → %', v_previous, p_new_status;
  end if;

  if p_new_status = 'cancelled'
     and (p_reason is null or length(trim(p_reason)) = 0) then
    raise exception 'Motivo obrigatório para cancelamento';
  end if;

  update public.orders o
  set
    status = p_new_status,
    cancelled_at = case when p_new_status = 'cancelled' then now() else o.cancelled_at end,
    cancelled_by = case when p_new_status = 'cancelled' then v_actor_id else o.cancelled_by end,
    cancellation_reason = case
      when p_new_status = 'cancelled' then trim(p_reason)
      else o.cancellation_reason
    end,
    payment_status = case
      when p_new_status = 'cancelled' and o.payment_status = 'pending'
        then 'cancelled'::public.payment_status
      else o.payment_status
    end,
    updated_at = now()
  where o.id = p_order_id
  returning * into v_order;

  if p_new_status = 'cancelled' then
    if v_order.coupon_id is not null then
      update public.coupons
      set uses_count = greatest(uses_count - 1, 0)
      where id = v_order.coupon_id;
    end if;

    update public.products p
    set
      stock_quantity = p.stock_quantity + agg.qty,
      is_available = case
        when p.stock_quantity + agg.qty > 0 then true
        else p.is_available
      end
    from (
      select product_id, sum(quantity) as qty
      from public.order_items
      where order_id = p_order_id
      group by product_id
    ) agg
    where agg.product_id = p.id
      and p.stock_quantity is not null;
  end if;

  insert into public.order_status_history (
    order_id,
    previous_status,
    new_status,
    actor_type,
    actor_id,
    reason
  ) values (
    p_order_id,
    v_previous,
    p_new_status,
    p_actor_type,
    v_actor_id,
    case
      when p_new_status = 'cancelled' then trim(p_reason)
      else nullif(trim(coalesce(p_reason, '')), '')
    end
  );

  return v_order;
end;
$function$;
