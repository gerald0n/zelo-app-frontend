-- Cupons (doc 104)
--
-- Tipos: percentual, valor fixo, frete grátis. Incidem sobre o SUBTOTAL de
-- produtos (não adicionais); "frete grátis" zera a taxa de entrega. Sem
-- acúmulo com promoção: se qualquer item do carrinho já tem preço promocional
-- (effective_price_cents < price_cents), o cupom é recusado.
--
-- Só limite total de usos (uses_count < max_uses) — sem limite por cliente
-- até o login por SMS (Fase 14). O uso é contado dentro da criação do pedido
-- (private.claim_coupon trava a linha e incrementa na mesma transação);
-- cancelar o pedido devolve (transition_order_status).
--
-- public.preview_coupon: versão read-only (não conta uso) pro checkout do
-- cliente mostrar o desconto antes de enviar.

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  discount_type text not null
    check (discount_type in ('percent', 'fixed', 'free_shipping')),
  -- percent: 1..100 ; fixed: centavos > 0 ; free_shipping: ignorado
  discount_value integer not null default 0,
  max_uses integer not null check (max_uses > 0),
  uses_count integer not null default 0 check (uses_count >= 0),
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_code_unique unique (code),
  constraint coupons_code_format check (code = upper(code) and length(code) between 3 and 32),
  constraint coupons_period_order
    check (starts_at is null or ends_at is null or starts_at < ends_at),
  constraint coupons_percent_range
    check (discount_type <> 'percent' or discount_value between 1 and 100),
  constraint coupons_fixed_positive
    check (discount_type <> 'fixed' or discount_value > 0)
);

create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

create index coupons_active_idx on public.coupons (is_active);

grant select, insert, update, delete on public.coupons to authenticated;
alter table public.coupons enable row level security;

create policy coupons_admin_manage
  on public.coupons for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

alter table public.orders
  add column coupon_id uuid references public.coupons (id) on delete set null,
  add column coupon_code text,
  add column coupon_discount_cents integer not null default 0;

-- O total agora desconta o cupom: subtotal + adicionais + frete - cupom.
alter table public.orders
  drop constraint orders_total_consistent,
  add constraint orders_total_consistent check (
    total_cents
      = subtotal_cents + add_ons_total_cents + delivery_fee_cents
        - coupon_discount_cents
  );

-- Valor do desconto em centavos, dado o tipo/valor do cupom e os totais.
create or replace function private.coupon_discount_cents(
  p_type text,
  p_value integer,
  p_subtotal_cents integer,
  p_delivery_fee_cents integer
) returns integer
language sql
immutable
as $$
  select case p_type
    when 'percent' then
      least(round(p_subtotal_cents * p_value / 100.0)::integer, p_subtotal_cents)
    when 'fixed' then least(p_value, p_subtotal_cents)
    when 'free_shipping' then p_delivery_fee_cents
    else 0
  end;
$$;

-- Checagem read-only pro checkout do cliente (não conta uso, não trava linha).
-- Recebe os produtos do carrinho e resolve sozinha se há promoção ativa.
create or replace function public.preview_coupon(
  p_code text,
  p_subtotal_cents integer,
  p_delivery_fee_cents integer,
  p_product_ids uuid[]
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, extensions
as $$
declare
  v_c public.coupons%rowtype;
  v_norm text := upper(trim(coalesce(p_code, '')));
  v_has_promo boolean;
begin
  select exists (
    select 1
    from public.products p
    where p.id = any(coalesce(p_product_ids, '{}'::uuid[]))
      and private.effective_price_cents(p.price_cents, p.category_id, p.id)
          < p.price_cents
  ) into v_has_promo;

  if v_norm = '' then
    return jsonb_build_object('valid', false, 'reason', 'empty');
  end if;

  select * into v_c from public.coupons where code = v_norm;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;
  if not v_c.is_active then
    return jsonb_build_object('valid', false, 'reason', 'inactive');
  end if;
  if v_c.starts_at is not null and v_c.starts_at > now() then
    return jsonb_build_object('valid', false, 'reason', 'not_started');
  end if;
  if v_c.ends_at is not null and v_c.ends_at <= now() then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;
  if v_c.uses_count >= v_c.max_uses then
    return jsonb_build_object('valid', false, 'reason', 'exhausted');
  end if;
  if v_has_promo then
    return jsonb_build_object('valid', false, 'reason', 'promo_conflict');
  end if;

  return jsonb_build_object(
    'valid', true,
    'code', v_c.code,
    'discountType', v_c.discount_type,
    'discountCents', private.coupon_discount_cents(
      v_c.discount_type, v_c.discount_value, p_subtotal_cents, p_delivery_fee_cents
    )
  );
end;
$$;

revoke all on function public.preview_coupon(text, integer, integer, uuid[]) from public;
grant execute on function public.preview_coupon(text, integer, integer, uuid[])
  to anon, authenticated;

-- Trava a linha, valida e incrementa uses_count. Lança em qualquer problema —
-- aborta a criação do pedido junto.
create or replace function private.claim_coupon(
  p_code text,
  p_subtotal_cents integer,
  p_delivery_fee_cents integer,
  p_has_promo boolean,
  out o_coupon_id uuid,
  out o_code text,
  out o_discount_cents integer
)
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_c public.coupons%rowtype;
  v_norm text := upper(trim(coalesce(p_code, '')));
begin
  select * into v_c from public.coupons where code = v_norm for update;
  if not found then
    raise exception 'Cupom inválido';
  end if;
  if not v_c.is_active then
    raise exception 'Cupom inativo';
  end if;
  if v_c.starts_at is not null and v_c.starts_at > now() then
    raise exception 'Cupom ainda não está valendo';
  end if;
  if v_c.ends_at is not null and v_c.ends_at <= now() then
    raise exception 'Cupom expirado';
  end if;
  if v_c.uses_count >= v_c.max_uses then
    raise exception 'Cupom esgotado';
  end if;
  if p_has_promo then
    raise exception 'Cupom não acumula com promoção';
  end if;

  update public.coupons set uses_count = uses_count + 1 where id = v_c.id;

  o_coupon_id := v_c.id;
  o_code := v_c.code;
  o_discount_cents := private.coupon_discount_cents(
    v_c.discount_type, v_c.discount_value, p_subtotal_cents, p_delivery_fee_cents
  );
end;
$$;


CREATE OR REPLACE FUNCTION private.create_order(payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
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
  v_has_promo boolean := false;
  v_coupon_code text;
  v_coupon_id uuid;
  v_coupon_discount integer := 0;
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
    if v_unit_price < v_product.price_cents then
      v_has_promo := true;
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
      v_coupon_code, v_subtotal, v_delivery_fee, v_has_promo
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
    coupon_discount_cents
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
    nullif(payload->>'source_order_id', '')::uuid,
    v_coupon_id,
    v_coupon_code,
    v_coupon_discount
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
$function$;

CREATE OR REPLACE FUNCTION private.create_manual_order(payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare
  v_customer_id uuid;
  v_guest_name text;
  v_guest_phone text;
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
  v_timing public.order_timing;
  v_delivery_method public.delivery_method;
  v_payment_method public.payment_method;
  v_scheduled_for timestamptz;
  v_already_paid boolean;
  v_address jsonb;
  v_has_promo boolean := false;
  v_coupon_code text;
  v_coupon_id uuid;
  v_coupon_discount integer := 0;
  v_store_lat numeric;
  v_store_lng numeric;
  v_actor_id uuid := auth.uid();
begin
  if not private.is_admin() then
    raise exception 'Somente administrador pode criar comanda manual';
  end if;

  v_guest_phone := nullif(payload->>'guest_phone_e164', '');
  v_guest_name := nullif(payload->>'guest_name', '');
  if v_guest_phone is null or v_guest_name is null then
    raise exception 'Nome e telefone são obrigatórios';
  end if;

  select id into v_customer_id
  from public.customers c
  where c.phone_e164 = v_guest_phone;

  if payload->'items' is null
     or jsonb_typeof(payload->'items') <> 'array'
     or jsonb_array_length(payload->'items') = 0 then
    raise exception 'Pedido deve conter ao menos um item';
  end if;

  v_timing := (payload->>'timing')::public.order_timing;
  v_delivery_method := (payload->>'delivery_method')::public.delivery_method;
  v_payment_method := (payload->>'payment_method')::public.payment_method;
  v_scheduled_for := nullif(payload->>'scheduled_for', '')::timestamptz;
  v_already_paid := coalesce((payload->>'already_paid')::boolean, false);
  v_address := payload->'address';
  v_coupon_code := nullif(upper(trim(coalesce(payload->>'coupon_code', ''))), '');

  if v_timing is null then
    raise exception 'timing é obrigatório';
  end if;
  if v_delivery_method is null then
    raise exception 'delivery_method é obrigatório';
  end if;
  if v_payment_method is null then
    raise exception 'payment_method é obrigatório';
  end if;
  if v_payment_method not in ('cash', 'card') then
    raise exception 'Forma de pagamento inválida para comanda manual';
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
    if v_unit_price < v_product.price_cents then
      v_has_promo := true;
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
      v_coupon_code, v_subtotal, v_delivery_fee, v_has_promo
    );
  end if;

  v_total := v_subtotal + v_addons_total + v_delivery_fee - v_coupon_discount;

  v_order_number := nextval('public.order_number_seq');

  insert into public.orders (
    id,
    order_number,
    customer_id,
    guest_name,
    guest_phone_e164,
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
    customer_note,
    coupon_id,
    coupon_code,
    coupon_discount_cents
  ) values (
    v_order_id,
    v_order_number,
    v_customer_id,
    case when v_customer_id is null then v_guest_name else null end,
    case when v_customer_id is null then v_guest_phone else null end,
    'received',
    v_timing,
    v_scheduled_for,
    v_delivery_method,
    v_payment_method,
    case when v_already_paid then 'confirmed'::public.payment_status
      else 'pending'::public.payment_status
    end,
    v_subtotal,
    v_addons_total,
    v_delivery_fee,
    v_total,
    nullif(payload->>'customer_note', ''),
    v_coupon_id,
    v_coupon_code,
    v_coupon_discount
  );

  if v_delivery_method = 'delivery' then
    select latitude, longitude into v_store_lat, v_store_lng
    from public.stores
    limit 1;

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
      v_store_lat,
      v_store_lng,
      0,
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
    'admin',
    v_actor_id,
    'Comanda manual'
  );

  return v_order_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.transition_order_status(p_order_id uuid, p_new_status order_status, p_actor_type status_change_actor_type, p_reason text DEFAULT NULL::text)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
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
    if v_order.coupon_id is not null then
      update public.coupons
      set uses_count = greatest(uses_count - 1, 0)
      where id = v_order.coupon_id;
    end if;

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
$function$;
