-- White label — Fase 0' (ADR-0001): backfill do store_id para a Zelo real.
--
-- Idempotente (só afeta linhas com store_id ainda nulo) — pode rodar de novo
-- sem efeito colateral. Em produção já existe uma loja neste ponto (a Zelo
-- real), então o backfill roda de verdade. Em dev local, `supabase db reset`
-- aplica todas as migrations ANTES do seed.sql — ou seja, `stores` ainda está
-- vazia quando esta migration roda. Nesse caso não há nada pra backfillar
-- ainda (as tabelas raiz também estão vazias, exceto as poucas com dado
-- seedado por migration anterior, ex. satellite_locations/pizza_sizes — essas
-- ficam com store_id nulo por ora e são cobertas pelo próprio `seed.sql`,
-- que faz o mesmo backfill depois de criar a loja local).

do $$
declare
  v_store_id uuid;
begin
  select id into v_store_id from public.stores order by created_at limit 1;

  if v_store_id is null then
    raise notice 'Nenhuma loja em public.stores ainda (esperado em dev local antes do seed) — pulando backfill nesta migration.';
    return;
  end if;

  update public.categories set store_id = v_store_id where store_id is null;
  update public.products set store_id = v_store_id where store_id is null;
  update public.add_ons set store_id = v_store_id where store_id is null;
  update public.customers set store_id = v_store_id where store_id is null;
  update public.orders set store_id = v_store_id where store_id is null;
  update public.carts set store_id = v_store_id where store_id is null;
  update public.coupons set store_id = v_store_id where store_id is null;
  update public.promotions set store_id = v_store_id where store_id is null;
  update public.satellite_locations set store_id = v_store_id where store_id is null;
  update public.admin_profiles set store_id = v_store_id where store_id is null;
  update public.push_templates set store_id = v_store_id where store_id is null;
  update public.promo_banners set store_id = v_store_id where store_id is null;
  update public.promo_modal_banners set store_id = v_store_id where store_id is null;
  update public.faq_items set store_id = v_store_id where store_id is null;
  update public.pizza_sizes set store_id = v_store_id where store_id is null;
  update public.pizza_flavor_prices set store_id = v_store_id where store_id is null;
  update public.pizza_addons set store_id = v_store_id where store_id is null;
end $$;
