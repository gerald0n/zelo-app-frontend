-- Recomendação automática no carrinho, por coocorrência de pedidos.
--
-- Regra: só recomenda quando o carrinho tem exatamente 1 produto distinto.
-- Para esse produto, busca o outro produto que mais apareceu junto com ele
-- no mesmo pedido (par simétrico), nos últimos p_since dias, exigindo pelo
-- menos p_min_count pedidos em comum. Sem mínimo batido, retorna vazio — sem
-- fallback (produto novo ou sem par forte simplesmente não recomenda nada).
--
-- Mesmo padrão de get_top_selling_products (20260911130000): `order_items`/
-- `orders` guardam dado de cliente e não têm policy de leitura pública, então
-- expõe só o agregado via RPC security definer.
create or replace function public.get_pair_recommendation(
  p_product_id uuid,
  p_since timestamptz,
  p_min_count integer default 3
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select paired.product_id
  from (
    select oi2.product_id, count(distinct oi1.order_id) as pair_count
    from order_items oi1
    join order_items oi2
      on oi2.order_id = oi1.order_id
      and oi2.product_id <> oi1.product_id
    join orders o on o.id = oi1.order_id
    where oi1.product_id = p_product_id
      and oi2.product_id is not null
      and o.created_at >= p_since
      and o.status <> 'cancelled'
    group by oi2.product_id
  ) paired
  join public.products p on p.id = paired.product_id
  where paired.pair_count >= p_min_count
    and p.archived_at is null
    and p.is_active = true
    and p.is_available = true
  order by paired.pair_count desc
  limit 1;
$$;

revoke all on function public.get_pair_recommendation(uuid, timestamptz, integer)
  from public;
grant execute on function public.get_pair_recommendation(uuid, timestamptz, integer)
  to anon, authenticated, service_role;
