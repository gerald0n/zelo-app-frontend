-- Fase H: cancelamento/transição de status com impersonação (service_role / identidade temp).

create or replace function public.transition_order_status_as_customer(
  p_customer_id uuid,
  p_order_id uuid,
  p_new_status public.order_status,
  p_reason text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, private, extensions
as $$
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

  return private.transition_order_status(
    p_order_id,
    p_new_status,
    'customer',
    p_reason
  );
end;
$$;

revoke all on function public.transition_order_status_as_customer(
  uuid, uuid, public.order_status, text
) from public;

grant execute on function public.transition_order_status_as_customer(
  uuid, uuid, public.order_status, text
) to service_role;
