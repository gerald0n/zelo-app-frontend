-- White label (ADR-0001, Fase C) — `private.reschedule_order`
-- (20260916180000, trazida do merge com `develop`) foi escrita antes do
-- RLS/identidade por tenant desta branch existir e ficou com duas lacunas
-- reais de isolamento entre lojas:
--
-- 1. Admin: checava só `private.is_admin()` (qualquer admin ativo, de
--    qualquer loja) — um admin de uma loja conseguia reagendar pedido de
--    outra. Precisa ser `private.is_admin_of_store(v_order.store_id)`,
--    mesmo padrão de toda RLS de admin desta fase.
-- 2. Cliente: comparava `v_order.customer_id <> auth.uid()` diretamente.
--    Desde a fatia de identidade por tenant (20260917150001),
--    `customers.id` (o perfil, o que `orders.customer_id` referencia) não
--    é mais igual a `auth.uid()` (a identidade de login compartilhada,
--    `customers.user_id`) — são colunas diferentes agora. Essa comparação
--    sempre falha pra sessão de cliente real pós-decouple, bloqueando o
--    próprio dono do pedido de reagendar. O jeito certo, usado em toda
--    RLS/RPC desta fase, é `private.current_customer_id()`.
--
-- Não é um bug que já esteja em produção: a feature de reagendamento e a
-- decoupling de identidade nasceram em branches diferentes e só se
-- encontram agora, nesta reconciliação. Corrigido aqui como
-- `create or replace function`, sem tocar no arquivo original — preserva o
-- histórico exato do que a `develop` aplicou.
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
  v_customer_id uuid := private.current_customer_id();
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
    if not private.is_admin_of_store(v_order.store_id) then
      raise exception 'Somente administrador pode reagendar como admin';
    end if;
    if v_order.status in ('delivered', 'cancelled') then
      raise exception 'Pedido % não pode mais ser reagendado', v_order.status;
    end if;
  elsif p_actor_type = 'customer' then
    if v_customer_id is null or v_order.customer_id <> v_customer_id then
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
