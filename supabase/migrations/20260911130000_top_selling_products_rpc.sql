-- "Mais vendidos" público (home do client). `order_items`/`orders` guardam
-- dado de cliente e não têm policy de leitura pública — em vez de abrir RLS
-- nessas tabelas, expõe só o agregado (product_id + quantidade somada) via
-- RPC security definer, no mesmo padrão de `public.is_admin()`.
create or replace function public.get_top_selling_products(
  p_since timestamptz,
  p_limit integer default 3
)
returns table (product_id uuid, total_quantity bigint)
language sql
stable
security definer
set search_path = public
as $$
  select oi.product_id, sum(oi.quantity)::bigint as total_quantity
  from order_items oi
  join orders o on o.id = oi.order_id
  where oi.product_id is not null
    and o.created_at >= p_since
    and o.status <> 'cancelled'
  group by oi.product_id
  order by total_quantity desc
  limit p_limit;
$$;

revoke all on function public.get_top_selling_products(timestamptz, integer)
  from public;
grant execute on function public.get_top_selling_products(timestamptz, integer)
  to anon, authenticated, service_role;
