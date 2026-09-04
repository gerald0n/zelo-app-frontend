-- Estoque básico de produtos (doc 103)
--
-- products.stock_quantity: integer nullable. NULL = ilimitado, não
-- controlado (ex.: bolo sob encomenda). Preenchido = quantidade controlada,
-- decrementada a cada pedido e devolvida ao cancelar.
--
-- private.create_order: checa estoque no primeiro loop (falha rápido, com
-- for update pra travar a linha) e decrementa no segundo loop com um UPDATE
-- condicional (where stock_quantity >= v_qty) que também serve de validação
-- final atômica — necessário porque duas linhas do mesmo produto no mesmo
-- payload não seriam pegas só pela checagem por item isolado. Quando o
-- estoque chega a 0, is_available vira false automaticamente.
--
-- private.transition_order_status: ao cancelar, devolve a soma das
-- quantidades de order_items por produto (agregado, pois pode haver mais de
-- uma linha do mesmo produto no pedido) e reativa is_available se o estoque
-- voltar a ficar > 0. Decisão: reativa incondicionalmente nesse caso — um
-- produto desativado manualmente por outro motivo enquanto também zerado é
-- um caso de borda raro comparado ao caso comum (reativar automaticamente ao
-- cancelar um pedido que havia zerado o estoque).

alter table public.products
  add column if not exists stock_quantity integer null;

alter table public.products
  drop constraint if exists products_stock_quantity_nonneg;

alter table public.products
  add constraint products_stock_quantity_nonneg
  check (stock_quantity is null or stock_quantity >= 0);

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
  v_product public.products%rowtype;
  v_addon_row public.add_ons%rowtype;
  v_unit_price integer;
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
  v_cart_id := nullif(payload->>'cart_id', '')::uuid;

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
  if v_delivery_method = 'delivery' and (
    v_address is null
    or v_address->>'street' is null
    or v_address->>'number' is null
    or v_address->>'neighborhood' is null
    or v_address->>'city' is null
    or v_address->>'state' is null
    or v_address->>'latitude' is null
    or v_address->>'longitude' is null
  ) then
    raise exception 'Endereço incompleto para entrega';
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

    if v_product.stock_quantity is not null and v_product.stock_quantity < v_qty then
      raise exception 'Estoque insuficiente: %', v_product.name;
    end if;

    v_unit_price := private.effective_price_cents(
      v_product.price_cents, v_product.category_id, v_product.id
    );
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
  end loop;

  if v_delivery_method = 'pickup' then
    v_delivery_fee := 0;
  else
    v_delivery_fee := coalesce((payload->>'delivery_fee_cents')::integer, 0);
    if v_delivery_fee < 0 then
      raise exception 'Taxa de entrega inválida';
    end if;
  end if;

  v_total := v_subtotal + v_addons_total + v_delivery_fee;

  if v_needs_change and (v_change_for is null or v_change_for < v_total) then
    raise exception 'Valor para troco inválido';
  end if;

  v_order_number := nextval('public.order_number_seq');

  insert into public.orders (
    id,
    order_number,
    customer_id,
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
    source_order_id
  ) values (
    v_order_id,
    v_order_number,
    v_customer_id,
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
    nullif(payload->>'source_order_id', '')::uuid
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
      delivery_fee_cents
    ) values (
      v_order_id,
      v_address->>'street',
      v_address->>'number',
      v_address->>'neighborhood',
      v_address->>'city',
      v_address->>'state',
      nullif(v_address->>'postal_code', ''),
      nullif(v_address->>'complement', ''),
      nullif(v_address->>'reference_point', ''),
      (v_address->>'latitude')::numeric,
      (v_address->>'longitude')::numeric,
      coalesce((payload->>'route_distance_meters')::integer, 0),
      v_delivery_fee
    );
  end if;

  for v_item in
    select value from jsonb_array_elements(payload->'items') as t(value)
  loop
    select * into v_product
    from public.products p
    where p.id = (v_item->>'product_id')::uuid;

    v_unit_price := private.effective_price_cents(
      v_product.price_cents, v_product.category_id, v_product.id
    );
    v_qty := (v_item->>'quantity')::integer;
    v_line_addons := 0;

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
      line_total_cents
    ) values (
      v_order_item_id,
      v_order_id,
      v_product.id,
      v_product.name,
      v_product.description,
      v_unit_price,
      v_qty,
      v_product.weight_min_grams,
      v_product.weight_max_grams,
      nullif(v_item->>'customer_note', ''),
      (v_unit_price + v_line_addons) * v_qty
    );

    if v_product.stock_quantity is not null then
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

create or replace function private.transition_order_status(
  p_order_id uuid,
  p_new_status public.order_status,
  p_actor_type public.status_change_actor_type,
  p_reason text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, private, extensions
as $$
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
      p_new_status in ('ready_for_delivery', 'ready_for_pickup', 'cancelled')
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
$$;
