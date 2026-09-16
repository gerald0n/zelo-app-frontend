-- White label (ADR-0001, Fase C) — orders passam a carregar store_id.
--
-- Mudança mínima e deliberada nesta função sensível (já causou uma saída de
-- produção antes — ver ADR-0001): só adiciona a declaração de
-- `v_store_id`, o preenchimento a partir do produto já validado no primeiro
-- loop (public.products tem store_id desde a Fase 0'/A, e `v_product` é
-- `%rowtype`, então já vem com a coluna sem precisar mudar o `select`), e a
-- coluna/valor no `insert into public.orders`. Nenhuma outra linha de lógica
-- de validação, preço ou estoque foi tocada — é uma cópia exata da versão
-- anterior (20260916170000_fix_create_order_empty_pizza_addons.sql) com
-- esses três acréscimos.
create or replace function private.create_order(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_customer_id uuid := private.current_customer_id();
  v_order_id uuid := gen_random_uuid();
  v_order_number bigint;
  v_item jsonb;
  v_addon jsonb;
  v_pizza_addon jsonb;
  v_product public.products%rowtype;
  v_secondary public.products%rowtype;
  v_addon_row public.add_ons%rowtype;
  v_pizza_addon_row public.pizza_addons%rowtype;
  v_pizza_size public.pizza_sizes%rowtype;
  v_unit_price integer;
  v_price1 integer;
  v_price2 integer;
  v_subtotal integer := 0;
  v_addons_total integer := 0;
  v_delivery_fee integer := 0;
  v_total integer;
  v_order_item_id uuid;
  v_qty integer;
  v_addon_qty integer;
  v_line_product integer;
  v_line_addons integer;
  v_cart_id uuid;
  v_timing public.order_timing;
  v_delivery_method public.delivery_method;
  v_payment_method public.payment_method;
  v_scheduled_for timestamptz;
  v_needs_change boolean;
  v_change_for integer;
  v_address jsonb;
  v_has_promo boolean := false;
  v_coupon_code text;
  v_coupon_id uuid;
  v_coupon_discount integer := 0;
  v_fulfillment_location_id uuid;
  v_pronta_entrega boolean;
  v_pizza_size_id uuid;
  v_secondary_product_id uuid;
  v_applies_to public.pizza_addon_application;
  v_product_name text;
  v_store_id uuid;
begin
  if v_customer_id is null then
    raise exception 'Não autenticado';
  end if;

  if not exists (select 1 from public.customers c where c.id = v_customer_id) then
    raise exception 'Cliente não encontrado';
  end if;

  if payload->'items' is null
     or jsonb_typeof(payload->'items') <> 'array'
     or jsonb_array_length(payload->'items') = 0 then
    raise exception 'Pedido deve conter ao menos um item';
  end if;

  v_timing := (payload->>'timing')::public.order_timing;
  v_delivery_method := (payload->>'delivery_method')::public.delivery_method;
  v_payment_method := (payload->>'payment_method')::public.payment_method;
  v_scheduled_for := nullif(payload->>'scheduled_for', '')::timestamptz;
  v_needs_change := coalesce((payload->>'needs_change')::boolean, false);
  v_change_for := nullif(payload->>'change_for_amount_cents', '')::integer;
  v_address := payload->'address';
  v_coupon_code := nullif(upper(trim(coalesce(payload->>'coupon_code', ''))), '');
  v_cart_id := nullif(payload->>'cart_id', '')::uuid;
  v_fulfillment_location_id := nullif(payload->>'fulfillment_location_id', '')::uuid;
  v_pronta_entrega := coalesce((payload->>'pronta_entrega')::boolean, false);

  if v_timing is null then
    raise exception 'timing é obrigatório';
  end if;
  if v_delivery_method is null then
    raise exception 'delivery_method é obrigatório';
  end if;
  if v_payment_method is null then
    raise exception 'payment_method é obrigatório';
  end if;
  if v_timing = 'scheduled' and v_scheduled_for is null then
    raise exception 'scheduled_for é obrigatório para pedidos agendados';
  end if;
  -- Só a coordenada confirmada é obrigatória: o texto do endereço continua
  -- sendo pedido no formulário, mas não bloqueia mais o pedido quando o
  -- Google não reconhece a rua (cliente usou localização atual/pin manual).
  if v_delivery_method = 'delivery' and (
    v_address is null
    or v_address->>'latitude' is null
    or v_address->>'longitude' is null
  ) then
    raise exception 'Endereço incompleto para entrega';
  end if;

  if v_fulfillment_location_id is not null then
    perform private.validate_satellite_fulfillment(
      v_fulfillment_location_id, v_delivery_method, v_timing, v_scheduled_for
    );
  end if;

  -- Validação e totais a partir dos preços do banco
  for v_item in
    select value from jsonb_array_elements(payload->'items') as t(value)
  loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    if v_qty <= 0 then
      raise exception 'Quantidade inválida no item';
    end if;

    select * into v_product
    from public.products p
    where p.id = (v_item->>'product_id')::uuid
      and p.archived_at is null
      and p.is_active = true
    for update;

    if not found then
      raise exception 'Produto inválido: %', v_item->>'product_id';
    end if;

    if not v_product.is_available then
      raise exception 'Produto indisponível: %', v_product.name;
    end if;

    v_store_id := v_product.store_id;

    -- Pronta entrega: item tem que ser exatamente do local satélite do
    -- pedido (lote curado, não é o cardápio normal). Encomenda (Pereiro ou
    -- via um local satélite): item tem que ser do cardápio normal — um
    -- produto de pronta entrega nunca entra numa encomenda, mas o cardápio
    -- normal vale pra encomenda em qualquer local.
    if v_pronta_entrega then
      if v_product.fulfillment_location_id is distinct from v_fulfillment_location_id then
        raise exception 'Produto não disponível para esta unidade: %', v_product.name;
      end if;
    elsif v_product.fulfillment_location_id is not null then
      raise exception 'Produto não disponível para encomenda: %', v_product.name;
    end if;

    if v_product.product_type = 'pizza_flavor' then
      v_pizza_size_id := nullif(v_item->>'pizza_size_id', '')::uuid;
      if v_pizza_size_id is null then
        raise exception 'Tamanho da pizza é obrigatório';
      end if;

      select * into v_pizza_size
      from public.pizza_sizes ps
      where ps.id = v_pizza_size_id
        and ps.is_active = true;

      if not found then
        raise exception 'Tamanho de pizza inválido';
      end if;

      select price_cents into v_price1
      from public.pizza_flavor_prices
      where product_id = v_product.id and size_id = v_pizza_size_id;

      if not found then
        raise exception 'Sabor % não disponível no tamanho %', v_product.name, v_pizza_size.name;
      end if;

      v_secondary_product_id := nullif(v_item->>'secondary_product_id', '')::uuid;

      if v_secondary_product_id is not null then
        select * into v_secondary
        from public.products p
        where p.id = v_secondary_product_id
          and p.archived_at is null
          and p.is_active = true
          and p.product_type = 'pizza_flavor';

        if not found then
          raise exception 'Segundo sabor inválido: %', v_secondary_product_id;
        end if;

        if not v_secondary.is_available then
          raise exception 'Sabor indisponível: %', v_secondary.name;
        end if;

        select price_cents into v_price2
        from public.pizza_flavor_prices
        where product_id = v_secondary.id and size_id = v_pizza_size_id;

        if not found then
          raise exception 'Sabor % não disponível no tamanho %', v_secondary.name, v_pizza_size.name;
        end if;

        v_unit_price := round((v_price1 + v_price2) / 2.0);
      else
        v_unit_price := v_price1;
      end if;
    else
      if v_product.stock_quantity is not null and v_product.stock_quantity < v_qty then
        raise exception 'Estoque insuficiente: %', v_product.name;
      end if;

      v_unit_price := private.effective_price_cents(
        v_product.price_cents, v_product.category_id, v_product.id
      );
      if v_unit_price < v_product.price_cents then
        v_has_promo := true;
      end if;
    end if;

    v_line_product := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line_product;

    if v_item->'add_ons' is not null and jsonb_typeof(v_item->'add_ons') = 'array' then
      for v_addon in
        select value from jsonb_array_elements(v_item->'add_ons') as a(value)
      loop
        v_addon_qty := coalesce((v_addon->>'quantity')::integer, 1);
        if v_addon_qty <= 0 then
          raise exception 'Quantidade inválida no adicional';
        end if;

        select * into v_addon_row
        from public.add_ons ao
        where ao.id = (v_addon->>'add_on_id')::uuid
          and ao.archived_at is null
          and ao.is_active = true;

        if not found then
          raise exception 'Adicional inválido: %', v_addon->>'add_on_id';
        end if;

        if not v_addon_row.is_available then
          raise exception 'Adicional indisponível: %', v_addon_row.name;
        end if;

        if not exists (
          select 1
          from public.product_add_ons pa
          where pa.product_id = v_product.id
            and pa.add_on_id = v_addon_row.id
        ) then
          raise exception 'Adicional % não permitido para %', v_addon_row.name, v_product.name;
        end if;

        v_addons_total := v_addons_total + (v_addon_row.price_cents * v_addon_qty * v_qty);
      end loop;
    end if;

    if v_item->'pizza_addons' is not null
       and jsonb_typeof(v_item->'pizza_addons') = 'array'
       and jsonb_array_length(v_item->'pizza_addons') > 0 then
      if v_product.product_type <> 'pizza_flavor' then
        raise exception 'Adicionais de pizza só valem para pizza';
      end if;

      for v_pizza_addon in
        select value from jsonb_array_elements(v_item->'pizza_addons') as a(value)
      loop
        v_applies_to := (v_pizza_addon->>'applies_to')::public.pizza_addon_application;
        if v_applies_to is null then
          raise exception 'applies_to é obrigatório no adicional de pizza';
        end if;
        if v_applies_to in ('flavor1', 'flavor2') and v_secondary_product_id is null then
          raise exception 'Pizza sem meio a meio não pode ter adicional por metade';
        end if;

        select * into v_pizza_addon_row
        from public.pizza_addons pao
        where pao.id = (v_pizza_addon->>'pizza_addon_id')::uuid
          and pao.archived_at is null
          and pao.is_active = true;

        if not found then
          raise exception 'Adicional de pizza inválido: %', v_pizza_addon->>'pizza_addon_id';
        end if;

        v_addons_total := v_addons_total + (
          case when v_applies_to = 'whole'
            then v_pizza_addon_row.price_full_cents
            else v_pizza_addon_row.price_half_cents
          end * v_qty
        );
      end loop;
    end if;
  end loop;

  if v_delivery_method = 'pickup' then
    v_delivery_fee := 0;
  else
    v_delivery_fee := coalesce((payload->>'delivery_fee_cents')::integer, 0);
    if v_delivery_fee < 0 then
      raise exception 'Taxa de entrega inválida';
    end if;
  end if;

  if v_coupon_code is not null then
    select o_coupon_id, o_code, o_discount_cents
    into v_coupon_id, v_coupon_code, v_coupon_discount
    from private.claim_coupon(
      v_coupon_code, v_subtotal, v_delivery_fee, v_has_promo, v_addons_total
    );
  end if;

  v_total := v_subtotal + v_addons_total + v_delivery_fee - v_coupon_discount;

  if v_needs_change and (v_change_for is null or v_change_for < v_total) then
    raise exception 'Valor para troco inválido';
  end if;

  v_order_number := nextval('public.order_number_seq');

  insert into public.orders (
    id,
    order_number,
    customer_id,
    store_id,
    status,
    timing,
    scheduled_for,
    delivery_method,
    payment_method,
    payment_status,
    subtotal_cents,
    add_ons_total_cents,
    delivery_fee_cents,
    total_cents,
    needs_change,
    change_for_amount_cents,
    customer_note,
    source_order_id,
    coupon_id,
    coupon_code,
    coupon_discount_cents,
    fulfillment_location_id
  ) values (
    v_order_id,
    v_order_number,
    v_customer_id,
    v_store_id,
    'received',
    v_timing,
    v_scheduled_for,
    v_delivery_method,
    v_payment_method,
    'pending',
    v_subtotal,
    v_addons_total,
    v_delivery_fee,
    v_total,
    case when v_payment_method = 'cash' then v_needs_change else null end,
    case when v_payment_method = 'cash' and v_needs_change then v_change_for else null end,
    nullif(payload->>'customer_note', ''),
    nullif(payload->>'source_order_id', '')::uuid,
    v_coupon_id,
    v_coupon_code,
    v_coupon_discount,
    v_fulfillment_location_id
  );

  if v_delivery_method = 'delivery' then
    insert into public.order_addresses (
      order_id,
      street,
      number,
      neighborhood,
      city,
      state,
      postal_code,
      complement,
      reference_point,
      latitude,
      longitude,
      route_distance_meters,
      delivery_fee_cents,
      location_source,
      location_accuracy_meters,
      google_formatted_address,
      location_diverged
    ) values (
      v_order_id,
      coalesce(v_address->>'street', ''),
      coalesce(v_address->>'number', ''),
      coalesce(v_address->>'neighborhood', ''),
      coalesce(v_address->>'city', ''),
      coalesce(v_address->>'state', ''),
      nullif(v_address->>'postal_code', ''),
      nullif(v_address->>'complement', ''),
      nullif(v_address->>'reference_point', ''),
      (v_address->>'latitude')::numeric,
      (v_address->>'longitude')::numeric,
      coalesce((payload->>'route_distance_meters')::integer, 0),
      v_delivery_fee,
      nullif(v_address->>'location_source', '')::public.location_source,
      nullif(v_address->>'location_accuracy_meters', '')::numeric,
      nullif(v_address->>'google_formatted_address', ''),
      coalesce((v_address->>'location_diverged')::boolean, false)
    );
  end if;

  for v_item in
    select value from jsonb_array_elements(payload->'items') as t(value)
  loop
    select * into v_product
    from public.products p
    where p.id = (v_item->>'product_id')::uuid;

    v_qty := (v_item->>'quantity')::integer;
    v_line_addons := 0;
    v_pizza_size_id := null;
    v_secondary_product_id := null;
    v_secondary := null;
    v_product_name := v_product.name;

    if v_product.product_type = 'pizza_flavor' then
      v_pizza_size_id := (v_item->>'pizza_size_id')::uuid;

      select price_cents into v_price1
      from public.pizza_flavor_prices
      where product_id = v_product.id and size_id = v_pizza_size_id;

      v_secondary_product_id := nullif(v_item->>'secondary_product_id', '')::uuid;

      if v_secondary_product_id is not null then
        select * into v_secondary
        from public.products p
        where p.id = v_secondary_product_id;

        select price_cents into v_price2
        from public.pizza_flavor_prices
        where product_id = v_secondary.id and size_id = v_pizza_size_id;

        v_unit_price := round((v_price1 + v_price2) / 2.0);
        v_product_name := v_product.name || ' / ' || v_secondary.name;
      else
        v_unit_price := v_price1;
      end if;
    else
      v_unit_price := private.effective_price_cents(
        v_product.price_cents, v_product.category_id, v_product.id
      );
    end if;

    if v_item->'add_ons' is not null and jsonb_typeof(v_item->'add_ons') = 'array' then
      for v_addon in
        select value from jsonb_array_elements(v_item->'add_ons') as a(value)
      loop
        select price_cents into v_addon_row.price_cents
        from public.add_ons ao
        where ao.id = (v_addon->>'add_on_id')::uuid;
        v_addon_qty := coalesce((v_addon->>'quantity')::integer, 1);
        v_line_addons := v_line_addons + (v_addon_row.price_cents * v_addon_qty);
      end loop;
    end if;

    if v_item->'pizza_addons' is not null and jsonb_typeof(v_item->'pizza_addons') = 'array' then
      for v_pizza_addon in
        select value from jsonb_array_elements(v_item->'pizza_addons') as a(value)
      loop
        v_applies_to := (v_pizza_addon->>'applies_to')::public.pizza_addon_application;

        select * into v_pizza_addon_row
        from public.pizza_addons pao
        where pao.id = (v_pizza_addon->>'pizza_addon_id')::uuid;

        v_line_addons := v_line_addons + (
          case when v_applies_to = 'whole'
            then v_pizza_addon_row.price_full_cents
            else v_pizza_addon_row.price_half_cents
          end
        );
      end loop;
    end if;

    v_order_item_id := gen_random_uuid();

    insert into public.order_items (
      id,
      order_id,
      product_id,
      product_name,
      product_description,
      unit_price_cents,
      quantity,
      weight_min_grams,
      weight_max_grams,
      customer_note,
      line_total_cents,
      pizza_size_id,
      secondary_product_id,
      secondary_product_name
    ) values (
      v_order_item_id,
      v_order_id,
      v_product.id,
      v_product_name,
      v_product.description,
      v_unit_price,
      v_qty,
      v_product.weight_min_grams,
      v_product.weight_max_grams,
      nullif(v_item->>'customer_note', ''),
      (v_unit_price + v_line_addons) * v_qty,
      v_pizza_size_id,
      v_secondary_product_id,
      v_secondary.name
    );

    if v_product.product_type <> 'pizza_flavor' and v_product.stock_quantity is not null then
      update public.products
      set
        stock_quantity = stock_quantity - v_qty,
        is_available = case
          when stock_quantity - v_qty <= 0 then false
          else is_available
        end
      where id = v_product.id
        and stock_quantity >= v_qty;

      if not found then
        raise exception 'Estoque insuficiente: %', v_product.name;
      end if;
    end if;

    if v_item->'add_ons' is not null and jsonb_typeof(v_item->'add_ons') = 'array' then
      for v_addon in
        select value from jsonb_array_elements(v_item->'add_ons') as a(value)
      loop
        select * into v_addon_row
        from public.add_ons ao
        where ao.id = (v_addon->>'add_on_id')::uuid;

        v_addon_qty := coalesce((v_addon->>'quantity')::integer, 1);

        insert into public.order_item_add_ons (
          order_item_id,
          add_on_id,
          add_on_name,
          unit_price_cents,
          quantity,
          line_total_cents
        ) values (
          v_order_item_id,
          v_addon_row.id,
          v_addon_row.name,
          v_addon_row.price_cents,
          v_addon_qty,
          v_addon_row.price_cents * v_addon_qty
        );
      end loop;
    end if;

    if v_item->'pizza_addons' is not null and jsonb_typeof(v_item->'pizza_addons') = 'array' then
      for v_pizza_addon in
        select value from jsonb_array_elements(v_item->'pizza_addons') as a(value)
      loop
        v_applies_to := (v_pizza_addon->>'applies_to')::public.pizza_addon_application;

        select * into v_pizza_addon_row
        from public.pizza_addons pao
        where pao.id = (v_pizza_addon->>'pizza_addon_id')::uuid;

        insert into public.order_item_pizza_addons (
          order_item_id,
          pizza_addon_id,
          pizza_addon_name,
          applies_to,
          unit_price_cents,
          line_total_cents
        ) values (
          v_order_item_id,
          v_pizza_addon_row.id,
          v_pizza_addon_row.name,
          v_applies_to,
          case when v_applies_to = 'whole'
            then v_pizza_addon_row.price_full_cents
            else v_pizza_addon_row.price_half_cents
          end,
          case when v_applies_to = 'whole'
            then v_pizza_addon_row.price_full_cents
            else v_pizza_addon_row.price_half_cents
          end * v_qty
        );
      end loop;
    end if;
  end loop;

  insert into public.order_status_history (
    order_id,
    previous_status,
    new_status,
    actor_type,
    actor_id,
    reason
  ) values (
    v_order_id,
    null,
    'received',
    'customer',
    v_customer_id,
    null
  );

  -- Expira e limpa o carrinho, se informado
  if v_cart_id is not null then
    if not exists (
      select 1
      from public.carts c
      where c.id = v_cart_id
        and c.customer_id = v_customer_id
    ) then
      raise exception 'Carrinho inválido';
    end if;

    delete from public.cart_item_pizza_addons cpa
    using public.cart_items ci
    where cpa.cart_item_id = ci.id
      and ci.cart_id = v_cart_id;

    delete from public.cart_item_add_ons cia
    using public.cart_items ci
    where cia.cart_item_id = ci.id
      and ci.cart_id = v_cart_id;

    delete from public.cart_items
    where cart_id = v_cart_id;

    update public.carts
    set
      expires_at = now(),
      last_activity_at = now(),
      updated_at = now()
    where id = v_cart_id;
  end if;

  return v_order_id;
end;
$$;
