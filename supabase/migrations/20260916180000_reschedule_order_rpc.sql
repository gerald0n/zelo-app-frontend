-- Reagendamento de pedido já criado (admin corrigindo um horário errado, ou
-- cliente adiantando/atrasando a entrega/retirada dele mesmo). Espelha as
-- guardas de `private.transition_order_status`: mesmos status permitidos
-- pro cliente ('received', 'confirmed', 'in_production' — os mesmos em que
-- ele já pode cancelar), admin sem restrição de status além de não poder
-- reagendar um pedido cancelado/entregue. A validação de "esse horário é
-- permitido pra essas categorias" é feita na aplicação (reusa
-- `resolveCartSchedulingRule`/`listAvailableScheduleTimes`) antes de chamar
-- este RPC — aqui só garantimos a integridade e a autorização.
create or replace function private.reschedule_order(
  p_order_id uuid,
  p_actor_type public.status_change_actor_type,
  p_new_scheduled_for timestamptz
)
returns public.orders
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_order public.orders%rowtype;
  v_previous_scheduled_for timestamptz;
  v_actor_id uuid := auth.uid();
begin
  if p_new_scheduled_for is null then
    raise exception 'new_scheduled_for é obrigatório';
  end if;

  select * into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if v_order.timing <> 'scheduled' then
    raise exception 'Pedido não é agendado';
  end if;

  if p_actor_type = 'admin' then
    if not private.is_admin() then
      raise exception 'Somente administrador pode reagendar como admin';
    end if;
    if v_order.status in ('delivered', 'cancelled') then
      raise exception 'Pedido % não pode mais ser reagendado', v_order.status;
    end if;
  elsif p_actor_type = 'customer' then
    if v_actor_id is null or v_order.customer_id <> v_actor_id then
      raise exception 'Cliente não autorizado para este pedido';
    end if;
    if v_order.status not in ('received', 'confirmed', 'in_production') then
      raise exception 'Cliente não pode reagendar este pedido';
    end if;
  else
    raise exception 'actor_type inválido';
  end if;

  v_previous_scheduled_for := v_order.scheduled_for;

  update public.orders o
  set
    scheduled_for = p_new_scheduled_for,
    updated_at = now()
  where o.id = p_order_id
  returning * into v_order;

  insert into public.audit_logs (
    actor_type,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    p_actor_type,
    v_actor_id,
    'order_rescheduled',
    'order',
    p_order_id,
    jsonb_build_object(
      'previous_scheduled_for', v_previous_scheduled_for,
      'new_scheduled_for', p_new_scheduled_for
    )
  );

  return v_order;
end;
$$;

revoke all on function private.reschedule_order(
  uuid, public.status_change_actor_type, timestamptz
) from public;

create or replace function public.reschedule_order(
  p_order_id uuid,
  p_actor_type public.status_change_actor_type,
  p_new_scheduled_for timestamptz
)
returns public.orders
language sql
security definer
set search_path = public, private, extensions
as $$
  select private.reschedule_order(p_order_id, p_actor_type, p_new_scheduled_for);
$$;

revoke all on function public.reschedule_order(
  uuid, public.status_change_actor_type, timestamptz
) from public;
grant execute on function public.reschedule_order(
  uuid, public.status_change_actor_type, timestamptz
) to authenticated;
