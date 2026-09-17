-- White label — Fase C do ADR-0001 (docs/adr/0001-plano-white-label-multitenant.md):
-- primeira fatia de "RLS de verdade" por store_id.
--
-- Decisão de arquitetura (substitui o "investigado e descartado" do ADR):
-- não precisamos expor `request.headers`/`x-store-id` via PostgREST pra
-- policy nenhuma. Pra todo contexto autenticado (admin, cliente) já existe
-- um mecanismo real e assinado — o JWT do Supabase Auth — e as funções
-- `private.is_admin()`/`private.current_customer_id()` já fazem lookup em
-- `admin_profiles`/`auth.uid()` via `security definer`. Só precisamos
-- estender esse mesmo padrão pra também carregar o `store_id` do usuário:
--
--   private.current_admin_store_id()    -> store_id do admin autenticado
--   private.current_customer_store_id() -> store_id do cliente autenticado
--   private.is_admin_of_store(store_id) -> admin ativo E (sem loja fixada,
--                                           reservado pro futuro apps/gestor
--                                           multi-loja, OU loja bate)
--
-- Leitura pública anônima de catálogo (anon, sem JWT de tenant) continua
-- sem predicado de store_id nesta fatia — é dado público por natureza (cada
-- tenant já expõe o próprio catálogo pra qualquer visitante do seu domínio)
-- e o filtro por `store_id` já é feito em JS (Fase C, fatias 1-2). Adicionar
-- isolamento de tenant em RLS pra leitura pública fica pra uma fatia própria
-- se algum dia isso deixar de ser aceitável.
--
-- Esta fatia cobre as tabelas "raiz" por tenant (as mesmas que ganharam
-- `store_id` na Fase A/0'). Tabelas filhas sem `store_id` direto
-- (product_images, product_add_ons, promotion_categories/products,
-- satellite_location_hours/delivery_slots, push_template_sends,
-- cart_item_*, order_item_*) continuam protegidas só pela FK pra tabela já
-- corrigida + `private.is_admin()` global — mesmo gap já registrado no ADR
-- ("cascata não verifica posse do tenant"), fica pra uma fatia própria.

create or replace function private.current_admin_store_id()
returns uuid
language sql
stable
security definer
set search_path = public, private
as $$
  select ap.store_id
  from public.admin_profiles ap
  where ap.id = auth.uid()
    and ap.is_active = true;
$$;

revoke all on function private.current_admin_store_id() from public;
grant execute on function private.current_admin_store_id() to anon, authenticated, service_role;

create or replace function private.current_customer_store_id()
returns uuid
language sql
stable
security definer
set search_path = public, private
as $$
  select c.store_id
  from public.customers c
  where c.id = private.current_customer_id();
$$;

revoke all on function private.current_customer_store_id() from public;
grant execute on function private.current_customer_store_id() to anon, authenticated, service_role;

create or replace function private.is_admin_of_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_admin()
    and (
      private.current_admin_store_id() is null
      or private.current_admin_store_id() = p_store_id
    );
$$;

revoke all on function private.is_admin_of_store(uuid) from public;
grant execute on function private.is_admin_of_store(uuid) to anon, authenticated, service_role;

-- stores
drop policy if exists stores_admin_manage on public.stores;
create policy stores_admin_manage
  on public.stores for all
  to authenticated
  using (private.is_admin_of_store(id))
  with check (private.is_admin_of_store(id));

-- store_business_hours
drop policy if exists store_business_hours_admin_manage on public.store_business_hours;
create policy store_business_hours_admin_manage
  on public.store_business_hours for all
  to authenticated
  using (private.is_admin_of_store(store_id))
  with check (private.is_admin_of_store(store_id));

-- store_blackout_periods
drop policy if exists store_blackout_periods_admin_manage on public.store_blackout_periods;
create policy store_blackout_periods_admin_manage
  on public.store_blackout_periods for all
  to authenticated
  using (private.is_admin_of_store(store_id))
  with check (private.is_admin_of_store(store_id));

-- admin_profiles (um admin só enxerga/edita perfis de admin da própria loja;
-- perfil com store_id nulo -- ainda não migrado -- só aparece pra quem também
-- tem store_id nulo, ou seja hoje continua igual até todo mundo ter loja)
drop policy if exists admin_profiles_admin_select on public.admin_profiles;
create policy admin_profiles_admin_select
  on public.admin_profiles for select
  to authenticated
  using (private.is_admin_of_store(store_id));

drop policy if exists admin_profiles_admin_update on public.admin_profiles;
create policy admin_profiles_admin_update
  on public.admin_profiles for update
  to authenticated
  using (private.is_admin_of_store(store_id))
  with check (private.is_admin_of_store(store_id));

-- customers
drop policy if exists customers_select_own on public.customers;
create policy customers_select_own
  on public.customers for select
  to authenticated
  using (id = private.current_customer_id() or private.is_admin_of_store(store_id));

drop policy if exists customers_update_own on public.customers;
create policy customers_update_own
  on public.customers for update
  to authenticated
  using (id = private.current_customer_id() or private.is_admin_of_store(store_id))
  with check (id = private.current_customer_id() or private.is_admin_of_store(store_id));

-- categories
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read
  on public.categories for select
  to anon, authenticated
  using (
    private.is_admin_of_store(store_id)
    or (is_active = true and archived_at is null)
  );

drop policy if exists categories_admin_manage on public.categories;
create policy categories_admin_manage
  on public.categories for all
  to authenticated
  using (private.is_admin_of_store(store_id))
  with check (private.is_admin_of_store(store_id));

-- products
drop policy if exists products_public_read on public.products;
create policy products_public_read
  on public.products for select
  to anon, authenticated
  using (
    private.is_admin_of_store(store_id)
    or (is_active = true and archived_at is null)
  );

drop policy if exists products_admin_manage on public.products;
create policy products_admin_manage
  on public.products for all
  to authenticated
  using (private.is_admin_of_store(store_id))
  with check (private.is_admin_of_store(store_id));

-- add_ons
drop policy if exists add_ons_public_read on public.add_ons;
create policy add_ons_public_read
  on public.add_ons for select
  to anon, authenticated
  using (
    private.is_admin_of_store(store_id)
    or (is_active = true and archived_at is null)
  );

drop policy if exists add_ons_admin_manage on public.add_ons;
create policy add_ons_admin_manage
  on public.add_ons for all
  to authenticated
  using (private.is_admin_of_store(store_id))
  with check (private.is_admin_of_store(store_id));

-- carts
drop policy if exists carts_select_own on public.carts;
create policy carts_select_own
  on public.carts for select
  to authenticated
  using (customer_id = private.current_customer_id() or private.is_admin_of_store(store_id));

drop policy if exists carts_update_own on public.carts;
create policy carts_update_own
  on public.carts for update
  to authenticated
  using (customer_id = private.current_customer_id() or private.is_admin_of_store(store_id))
  with check (customer_id = private.current_customer_id() or private.is_admin_of_store(store_id));

drop policy if exists carts_delete_own on public.carts;
create policy carts_delete_own
  on public.carts for delete
  to authenticated
  using (customer_id = private.current_customer_id() or private.is_admin_of_store(store_id));

-- orders (leitura; escrita via funções)
drop policy if exists orders_select_own on public.orders;
create policy orders_select_own
  on public.orders for select
  to authenticated
  using (customer_id = private.current_customer_id() or private.is_admin_of_store(store_id));

drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update
  on public.orders for update
  to authenticated
  using (private.is_admin_of_store(store_id))
  with check (private.is_admin_of_store(store_id));

-- coupons
drop policy if exists coupons_admin_manage on public.coupons;
create policy coupons_admin_manage
  on public.coupons for all
  to authenticated
  using (private.is_admin_of_store(store_id))
  with check (private.is_admin_of_store(store_id));

-- promotions
drop policy if exists promotions_public_read on public.promotions;
create policy promotions_public_read
  on public.promotions for select
  to anon, authenticated
  using (
    private.is_admin_of_store(store_id)
    or (
      is_active = true
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
    )
  );

drop policy if exists promotions_admin_manage on public.promotions;
create policy promotions_admin_manage
  on public.promotions for all
  to authenticated
  using (private.is_admin_of_store(store_id))
  with check (private.is_admin_of_store(store_id));

-- satellite_locations
drop policy if exists satellite_locations_admin_manage on public.satellite_locations;
create policy satellite_locations_admin_manage
  on public.satellite_locations for all
  to authenticated
  using (private.is_admin_of_store(store_id))
  with check (private.is_admin_of_store(store_id));

-- push_templates
drop policy if exists push_templates_admin_manage on public.push_templates;
create policy push_templates_admin_manage
  on public.push_templates for all
  to authenticated
  using (private.is_admin_of_store(store_id))
  with check (private.is_admin_of_store(store_id));

-- promo_banners
drop policy if exists promo_banners_public_read on public.promo_banners;
create policy promo_banners_public_read
  on public.promo_banners for select
  to anon, authenticated
  using (
    private.is_admin_of_store(store_id)
    or (
      is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
    )
  );

drop policy if exists promo_banners_admin_manage on public.promo_banners;
create policy promo_banners_admin_manage
  on public.promo_banners for all
  to authenticated
  using (private.is_admin_of_store(store_id))
  with check (private.is_admin_of_store(store_id));

-- promo_modal_banners
drop policy if exists promo_modal_banners_public_read on public.promo_modal_banners;
create policy promo_modal_banners_public_read
  on public.promo_modal_banners for select
  to anon, authenticated
  using (
    private.is_admin_of_store(store_id)
    or (
      is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
    )
  );

drop policy if exists promo_modal_banners_admin_manage on public.promo_modal_banners;
create policy promo_modal_banners_admin_manage
  on public.promo_modal_banners for all
  to authenticated
  using (private.is_admin_of_store(store_id))
  with check (private.is_admin_of_store(store_id));

-- faq_items
drop policy if exists faq_items_public_read on public.faq_items;
create policy faq_items_public_read
  on public.faq_items for select
  to anon, authenticated
  using (private.is_admin_of_store(store_id) or is_active);

drop policy if exists faq_items_admin_manage on public.faq_items;
create policy faq_items_admin_manage
  on public.faq_items for all
  to authenticated
  using (private.is_admin_of_store(store_id))
  with check (private.is_admin_of_store(store_id));

-- pizza_sizes
drop policy if exists pizza_sizes_public_read on public.pizza_sizes;
create policy pizza_sizes_public_read
  on public.pizza_sizes for select
  to anon, authenticated
  using (private.is_admin_of_store(store_id) or is_active = true);

drop policy if exists pizza_sizes_admin_manage on public.pizza_sizes;
create policy pizza_sizes_admin_manage
  on public.pizza_sizes for all
  to authenticated
  using (private.is_admin_of_store(store_id))
  with check (private.is_admin_of_store(store_id));

-- pizza_flavor_prices
drop policy if exists pizza_flavor_prices_public_read on public.pizza_flavor_prices;
create policy pizza_flavor_prices_public_read
  on public.pizza_flavor_prices for select
  to anon, authenticated
  using (
    private.is_admin_of_store(store_id)
    or exists (
      select 1 from public.products p
      where p.id = pizza_flavor_prices.product_id
        and p.archived_at is null
        and p.is_active = true
    )
  );

drop policy if exists pizza_flavor_prices_admin_manage on public.pizza_flavor_prices;
create policy pizza_flavor_prices_admin_manage
  on public.pizza_flavor_prices for all
  to authenticated
  using (private.is_admin_of_store(store_id))
  with check (private.is_admin_of_store(store_id));

-- pizza_addons
drop policy if exists pizza_addons_public_read on public.pizza_addons;
create policy pizza_addons_public_read
  on public.pizza_addons for select
  to anon, authenticated
  using (
    private.is_admin_of_store(store_id)
    or (is_active = true and archived_at is null)
  );

drop policy if exists pizza_addons_admin_manage on public.pizza_addons;
create policy pizza_addons_admin_manage
  on public.pizza_addons for all
  to authenticated
  using (private.is_admin_of_store(store_id))
  with check (private.is_admin_of_store(store_id));
