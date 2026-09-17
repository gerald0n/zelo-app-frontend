-- White label — Fase C do ADR-0001: oitava fatia de "RLS de verdade".
--
-- A fatia anterior (20260917120000) cobriu as tabelas raiz com `store_id`
-- direto. Esta fatia fecha o gap registrado lá: tabelas filhas sem
-- `store_id` próprio, que herdavam o tenant só via FK pra tabela já
-- corrigida, mas cuja policy ainda usava `private.is_admin()` global (então
-- um admin de outro tenant conseguia gerenciar imagem/adicional/slot de
-- horário/envio de push/etc. de qualquer loja). O bypass de admin de cada
-- policy passa a checar a posse do tenant via join até a tabela raiz —
-- `private.is_admin_of_store(<raiz>.store_id)` em vez de só
-- `private.is_admin()` — igual ao padrão já usado nas policies "_own" que já
-- faziam join pra checar dono da linha.

-- product_images (via products)
drop policy if exists product_images_public_read on public.product_images;
create policy product_images_public_read
  on public.product_images for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_images.product_id
        and (
          private.is_admin_of_store(p.store_id)
          or (p.is_active = true and p.archived_at is null)
        )
    )
  );

drop policy if exists product_images_admin_manage on public.product_images;
create policy product_images_admin_manage
  on public.product_images for all
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and private.is_admin_of_store(p.store_id)
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and private.is_admin_of_store(p.store_id)
    )
  );

-- product_add_ons (via products)
drop policy if exists product_add_ons_public_read on public.product_add_ons;
create policy product_add_ons_public_read
  on public.product_add_ons for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      join public.add_ons a on a.id = product_add_ons.add_on_id
      where p.id = product_add_ons.product_id
        and (
          private.is_admin_of_store(p.store_id)
          or (
            p.is_active = true and p.archived_at is null
            and a.is_active = true and a.archived_at is null
          )
        )
    )
  );

drop policy if exists product_add_ons_admin_manage on public.product_add_ons;
create policy product_add_ons_admin_manage
  on public.product_add_ons for all
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_add_ons.product_id
        and private.is_admin_of_store(p.store_id)
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_add_ons.product_id
        and private.is_admin_of_store(p.store_id)
    )
  );

-- promotion_categories (via promotions)
drop policy if exists promotion_categories_public_read on public.promotion_categories;
create policy promotion_categories_public_read
  on public.promotion_categories for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.promotions pr
      where pr.id = promotion_categories.promotion_id
        and (
          private.is_admin_of_store(pr.store_id)
          or (
            pr.is_active = true
            and (pr.starts_at is null or pr.starts_at <= now())
            and (pr.ends_at is null or pr.ends_at > now())
          )
        )
    )
  );

drop policy if exists promotion_categories_admin_manage on public.promotion_categories;
create policy promotion_categories_admin_manage
  on public.promotion_categories for all
  to authenticated
  using (
    exists (
      select 1 from public.promotions pr
      where pr.id = promotion_categories.promotion_id
        and private.is_admin_of_store(pr.store_id)
    )
  )
  with check (
    exists (
      select 1 from public.promotions pr
      where pr.id = promotion_categories.promotion_id
        and private.is_admin_of_store(pr.store_id)
    )
  );

-- promotion_products (via promotions)
drop policy if exists promotion_products_public_read on public.promotion_products;
create policy promotion_products_public_read
  on public.promotion_products for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.promotions pr
      where pr.id = promotion_products.promotion_id
        and (
          private.is_admin_of_store(pr.store_id)
          or (
            pr.is_active = true
            and (pr.starts_at is null or pr.starts_at <= now())
            and (pr.ends_at is null or pr.ends_at > now())
          )
        )
    )
  );

drop policy if exists promotion_products_admin_manage on public.promotion_products;
create policy promotion_products_admin_manage
  on public.promotion_products for all
  to authenticated
  using (
    exists (
      select 1 from public.promotions pr
      where pr.id = promotion_products.promotion_id
        and private.is_admin_of_store(pr.store_id)
    )
  )
  with check (
    exists (
      select 1 from public.promotions pr
      where pr.id = promotion_products.promotion_id
        and private.is_admin_of_store(pr.store_id)
    )
  );

-- satellite_location_hours (via satellite_locations)
drop policy if exists satellite_location_hours_admin_manage on public.satellite_location_hours;
create policy satellite_location_hours_admin_manage
  on public.satellite_location_hours for all
  to authenticated
  using (
    exists (
      select 1 from public.satellite_locations sl
      where sl.id = satellite_location_hours.location_id
        and private.is_admin_of_store(sl.store_id)
    )
  )
  with check (
    exists (
      select 1 from public.satellite_locations sl
      where sl.id = satellite_location_hours.location_id
        and private.is_admin_of_store(sl.store_id)
    )
  );

-- satellite_location_delivery_slots (via satellite_locations)
drop policy if exists satellite_location_delivery_slots_admin_manage on public.satellite_location_delivery_slots;
create policy satellite_location_delivery_slots_admin_manage
  on public.satellite_location_delivery_slots for all
  to authenticated
  using (
    exists (
      select 1 from public.satellite_locations sl
      where sl.id = satellite_location_delivery_slots.location_id
        and private.is_admin_of_store(sl.store_id)
    )
  )
  with check (
    exists (
      select 1 from public.satellite_locations sl
      where sl.id = satellite_location_delivery_slots.location_id
        and private.is_admin_of_store(sl.store_id)
    )
  );

-- push_template_sends (via push_templates)
drop policy if exists push_template_sends_admin_manage on public.push_template_sends;
create policy push_template_sends_admin_manage
  on public.push_template_sends for all
  to authenticated
  using (
    exists (
      select 1 from public.push_templates pt
      where pt.id = push_template_sends.template_id
        and private.is_admin_of_store(pt.store_id)
    )
  )
  with check (
    exists (
      select 1 from public.push_templates pt
      where pt.id = push_template_sends.template_id
        and private.is_admin_of_store(pt.store_id)
    )
  );

-- cart_items (via carts)
drop policy if exists cart_items_select_own on public.cart_items;
create policy cart_items_select_own
  on public.cart_items for select
  to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and (
          c.customer_id = private.current_customer_id()
          or private.is_admin_of_store(c.store_id)
        )
    )
  );

drop policy if exists cart_items_update_own on public.cart_items;
create policy cart_items_update_own
  on public.cart_items for update
  to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and (
          c.customer_id = private.current_customer_id()
          or private.is_admin_of_store(c.store_id)
        )
    )
  )
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and (
          c.customer_id = private.current_customer_id()
          or private.is_admin_of_store(c.store_id)
        )
    )
  );

drop policy if exists cart_items_delete_own on public.cart_items;
create policy cart_items_delete_own
  on public.cart_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and (
          c.customer_id = private.current_customer_id()
          or private.is_admin_of_store(c.store_id)
        )
    )
  );

-- cart_item_add_ons (via cart_items -> carts)
drop policy if exists cart_item_add_ons_select_own on public.cart_item_add_ons;
create policy cart_item_add_ons_select_own
  on public.cart_item_add_ons for select
  to authenticated
  using (
    exists (
      select 1
      from public.cart_items ci
      join public.carts c on c.id = ci.cart_id
      where ci.id = cart_item_add_ons.cart_item_id
        and (
          c.customer_id = private.current_customer_id()
          or private.is_admin_of_store(c.store_id)
        )
    )
  );

drop policy if exists cart_item_add_ons_update_own on public.cart_item_add_ons;
create policy cart_item_add_ons_update_own
  on public.cart_item_add_ons for update
  to authenticated
  using (
    exists (
      select 1
      from public.cart_items ci
      join public.carts c on c.id = ci.cart_id
      where ci.id = cart_item_add_ons.cart_item_id
        and (
          c.customer_id = private.current_customer_id()
          or private.is_admin_of_store(c.store_id)
        )
    )
  )
  with check (
    exists (
      select 1
      from public.cart_items ci
      join public.carts c on c.id = ci.cart_id
      where ci.id = cart_item_add_ons.cart_item_id
        and (
          c.customer_id = private.current_customer_id()
          or private.is_admin_of_store(c.store_id)
        )
    )
  );

drop policy if exists cart_item_add_ons_delete_own on public.cart_item_add_ons;
create policy cart_item_add_ons_delete_own
  on public.cart_item_add_ons for delete
  to authenticated
  using (
    exists (
      select 1
      from public.cart_items ci
      join public.carts c on c.id = ci.cart_id
      where ci.id = cart_item_add_ons.cart_item_id
        and (
          c.customer_id = private.current_customer_id()
          or private.is_admin_of_store(c.store_id)
        )
    )
  );

-- cart_item_pizza_addons (via cart_items -> carts)
drop policy if exists cart_item_pizza_addons_select_own on public.cart_item_pizza_addons;
create policy cart_item_pizza_addons_select_own
  on public.cart_item_pizza_addons for select
  to authenticated
  using (
    exists (
      select 1
      from public.cart_items ci
      join public.carts c on c.id = ci.cart_id
      where ci.id = cart_item_pizza_addons.cart_item_id
        and (
          c.customer_id = private.current_customer_id()
          or private.is_admin_of_store(c.store_id)
        )
    )
  );

drop policy if exists cart_item_pizza_addons_update_own on public.cart_item_pizza_addons;
create policy cart_item_pizza_addons_update_own
  on public.cart_item_pizza_addons for update
  to authenticated
  using (
    exists (
      select 1
      from public.cart_items ci
      join public.carts c on c.id = ci.cart_id
      where ci.id = cart_item_pizza_addons.cart_item_id
        and (
          c.customer_id = private.current_customer_id()
          or private.is_admin_of_store(c.store_id)
        )
    )
  )
  with check (
    exists (
      select 1
      from public.cart_items ci
      join public.carts c on c.id = ci.cart_id
      where ci.id = cart_item_pizza_addons.cart_item_id
        and c.customer_id = private.current_customer_id()
    )
  );

drop policy if exists cart_item_pizza_addons_delete_own on public.cart_item_pizza_addons;
create policy cart_item_pizza_addons_delete_own
  on public.cart_item_pizza_addons for delete
  to authenticated
  using (
    exists (
      select 1
      from public.cart_items ci
      join public.carts c on c.id = ci.cart_id
      where ci.id = cart_item_pizza_addons.cart_item_id
        and (
          c.customer_id = private.current_customer_id()
          or private.is_admin_of_store(c.store_id)
        )
    )
  );

-- order_addresses (via orders)
drop policy if exists order_addresses_select_own on public.order_addresses;
create policy order_addresses_select_own
  on public.order_addresses for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_addresses.order_id
        and (
          o.customer_id = private.current_customer_id()
          or private.is_admin_of_store(o.store_id)
        )
    )
  );

-- order_items (via orders)
drop policy if exists order_items_select_own on public.order_items;
create policy order_items_select_own
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          o.customer_id = private.current_customer_id()
          or private.is_admin_of_store(o.store_id)
        )
    )
  );

-- order_item_add_ons (via order_items -> orders)
drop policy if exists order_item_add_ons_select_own on public.order_item_add_ons;
create policy order_item_add_ons_select_own
  on public.order_item_add_ons for select
  to authenticated
  using (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_add_ons.order_item_id
        and (
          o.customer_id = private.current_customer_id()
          or private.is_admin_of_store(o.store_id)
        )
    )
  );

-- order_item_pizza_addons (via order_items -> orders)
drop policy if exists order_item_pizza_addons_select_own on public.order_item_pizza_addons;
create policy order_item_pizza_addons_select_own
  on public.order_item_pizza_addons for select
  to authenticated
  using (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_pizza_addons.order_item_id
        and (
          o.customer_id = private.current_customer_id()
          or private.is_admin_of_store(o.store_id)
        )
    )
  );

-- order_status_history (via orders)
drop policy if exists order_status_history_select_own on public.order_status_history;
create policy order_status_history_select_own
  on public.order_status_history for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and (
          o.customer_id = private.current_customer_id()
          or private.is_admin_of_store(o.store_id)
        )
    )
  );
