-- Ponto satélite São Miguel/RN: segundo local de atendimento (encomenda e
-- "pronta entrega"), ativo só quarta/quinta/sexta, com endereço, raio/taxa de
-- entrega e horários próprios — independentes da loja de Pereiro.
--
-- Não generaliza `stores`/`store_business_hours` (que seguem singleton em
-- todo o código): é um segundo local específico, com sua própria janela de
-- retirada (08h-18h, sem grade de horários) e uma lista curta e explícita de
-- horários fixos de entrega por dia da semana (não a grade por intervalo do
-- motor de agendamento de categoria).

create table public.satellite_locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  address_line text not null,
  city text not null,
  state text not null,
  postal_code text,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  free_delivery_radius_meters integer not null default 0,
  fixed_delivery_fee_cents integer not null default 0,
  max_delivery_radius_meters integer not null default 0,
  min_lead_minutes integer not null default 120,
  timezone text not null default 'America/Fortaleza',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint satellite_locations_free_radius_nonneg
    check (free_delivery_radius_meters >= 0),
  constraint satellite_locations_fixed_fee_nonneg
    check (fixed_delivery_fee_cents >= 0),
  constraint satellite_locations_max_radius_ge_free
    check (max_delivery_radius_meters >= free_delivery_radius_meters),
  constraint satellite_locations_min_lead_range
    check (min_lead_minutes between 0 and 1440),
  constraint satellite_locations_timezone_not_empty
    check (length(trim(timezone)) > 0)
);

create trigger satellite_locations_set_updated_at
  before update on public.satellite_locations
  for each row execute function public.set_updated_at();

create table public.satellite_location_hours (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.satellite_locations (id) on delete cascade,
  weekday smallint not null,
  is_closed boolean not null default true,
  pickup_opens_at time,
  pickup_closes_at time,
  delivery_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint satellite_location_hours_weekday_range
    check (weekday between 0 and 6),
  constraint satellite_location_hours_open_window
    check (
      is_closed
      or (
        pickup_opens_at is not null
        and pickup_closes_at is not null
        and pickup_opens_at < pickup_closes_at
      )
    ),
  constraint satellite_location_hours_location_weekday_unique
    unique (location_id, weekday)
);

create trigger satellite_location_hours_set_updated_at
  before update on public.satellite_location_hours
  for each row execute function public.set_updated_at();

-- Lista curta e explícita (não uma grade por intervalo): cada linha é um
-- horário de entrega realmente oferecido naquele dia da semana. O admin
-- adiciona/remove linhas por essa tabela, sem precisar de migration.
create table public.satellite_location_delivery_slots (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.satellite_locations (id) on delete cascade,
  weekday smallint not null,
  starts_at time not null,
  ends_at time,
  label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint satellite_location_delivery_slots_weekday_range
    check (weekday between 0 and 6),
  constraint satellite_location_delivery_slots_window
    check (ends_at is null or ends_at > starts_at),
  constraint satellite_location_delivery_slots_unique
    unique (location_id, weekday, starts_at)
);

-- ---------------------------------------------------------------------------
-- Pedidos e produtos: vínculo aditivo com o local satélite
-- ---------------------------------------------------------------------------

alter table public.orders
  add column fulfillment_location_id uuid references public.satellite_locations (id);

-- Um sabor de "pronta entrega" é uma linha de produto própria (duplicada do
-- catálogo normal), com seu próprio stock_quantity — não altera a lógica de
-- decremento já existente, só passa a valer também pra essas linhas. NULL
-- (padrão) continua sendo produto normal do catálogo de Pereiro.
alter table public.products
  add column fulfillment_location_id uuid references public.satellite_locations (id);

create index products_fulfillment_location_id_idx
  on public.products (fulfillment_location_id)
  where fulfillment_location_id is not null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.satellite_locations enable row level security;
alter table public.satellite_location_hours enable row level security;
alter table public.satellite_location_delivery_slots enable row level security;

grant select on public.satellite_locations to anon, authenticated;
grant select, insert, update, delete on public.satellite_locations to authenticated;

grant select on public.satellite_location_hours to anon, authenticated;
grant select, insert, update, delete on public.satellite_location_hours to authenticated;

grant select on public.satellite_location_delivery_slots to anon, authenticated;
grant select, insert, update, delete on public.satellite_location_delivery_slots to authenticated;

create policy satellite_locations_public_read
  on public.satellite_locations for select
  to anon, authenticated
  using (true);

create policy satellite_locations_admin_manage
  on public.satellite_locations for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy satellite_location_hours_public_read
  on public.satellite_location_hours for select
  to anon, authenticated
  using (true);

create policy satellite_location_hours_admin_manage
  on public.satellite_location_hours for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy satellite_location_delivery_slots_public_read
  on public.satellite_location_delivery_slots for select
  to anon, authenticated
  using (true);

create policy satellite_location_delivery_slots_admin_manage
  on public.satellite_location_delivery_slots for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- Seed: São Miguel/RN (EVOCORP, Tota Barbosa) — quarta a sexta, retirada
-- 08h-18h, entrega com rota do meio-dia (12h-12h50) + horário da noite
-- (18h qua/qui, 17h sex).
-- ---------------------------------------------------------------------------
do $$
declare
  v_location_id uuid;
begin
  insert into public.satellite_locations (
    slug, name, address_line, city, state, postal_code,
    latitude, longitude,
    free_delivery_radius_meters, fixed_delivery_fee_cents, max_delivery_radius_meters,
    min_lead_minutes, timezone, is_active
  ) values (
    'sao-miguel',
    'São Miguel/RN',
    'Rua Francisca Rodrigues, 164 - Tota Barbosa',
    'São Miguel',
    'RN',
    '59920-000',
    -6.205475,
    -38.491838,
    2000,
    500,
    5000,
    120,
    'America/Fortaleza',
    true
  )
  returning id into v_location_id;

  insert into public.satellite_location_hours (
    location_id, weekday, is_closed, pickup_opens_at, pickup_closes_at, delivery_enabled
  )
  select
    v_location_id,
    weekday,
    weekday not in (3, 4, 5) as is_closed,
    case when weekday in (3, 4, 5) then time '08:00' end,
    case when weekday in (3, 4, 5) then time '18:00' end,
    weekday in (3, 4, 5)
  from generate_series(0, 6) as weekday;

  insert into public.satellite_location_delivery_slots (
    location_id, weekday, starts_at, ends_at, label, sort_order
  ) values
    (v_location_id, 3, time '12:00', time '12:50', 'Rota do meio-dia', 0),
    (v_location_id, 3, time '18:00', null, null, 1),
    (v_location_id, 4, time '12:00', time '12:50', 'Rota do meio-dia', 0),
    (v_location_id, 4, time '18:00', null, null, 1),
    (v_location_id, 5, time '12:00', time '12:50', 'Rota do meio-dia', 0),
    (v_location_id, 5, time '17:00', null, null, 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- private.validate_satellite_fulfillment: valida dia/horário de um pedido
-- pro local satélite. Só é chamada quando o pedido informa
-- fulfillment_location_id — pedidos de Pereiro não mudam de comportamento.
-- ---------------------------------------------------------------------------
create or replace function private.validate_satellite_fulfillment(
  p_location_id uuid,
  p_delivery_method public.delivery_method,
  p_timing public.order_timing,
  p_scheduled_for timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_location public.satellite_locations%rowtype;
  v_hour public.satellite_location_hours%rowtype;
  v_instant timestamptz;
  v_weekday integer;
  v_time time;
  v_slot_match boolean;
begin
  select * into v_location
  from public.satellite_locations sl
  where sl.id = p_location_id;

  if not found or not v_location.is_active then
    raise exception 'Unidade indisponível';
  end if;

  if p_delivery_method = 'delivery' and p_timing = 'immediate' then
    raise exception 'Entrega imediata não disponível nesta unidade';
  end if;

  v_instant := coalesce(p_scheduled_for, now());
  v_weekday := extract(dow from (v_instant at time zone v_location.timezone))::integer;
  v_time := (v_instant at time zone v_location.timezone)::time;

  select * into v_hour
  from public.satellite_location_hours h
  where h.location_id = p_location_id
    and h.weekday = v_weekday;

  if not found or v_hour.is_closed then
    raise exception 'Unidade fechada nesse dia';
  end if;

  if p_delivery_method = 'pickup' then
    if v_time < v_hour.pickup_opens_at or v_time > v_hour.pickup_closes_at then
      raise exception 'Horário de retirada fora da janela da unidade';
    end if;
  elsif p_delivery_method = 'delivery' then
    if not v_hour.delivery_enabled then
      raise exception 'Entrega não disponível nesse dia para esta unidade';
    end if;

    select exists (
      select 1
      from public.satellite_location_delivery_slots s
      where s.location_id = p_location_id
        and s.weekday = v_weekday
        and s.starts_at = v_time
    ) into v_slot_match;

    if not v_slot_match then
      raise exception 'Horário de entrega inválido para esta unidade';
    end if;
  end if;
end;
$$;

revoke all on function private.validate_satellite_fulfillment(uuid, public.delivery_method, public.order_timing, timestamptz) from public;
grant execute on function private.validate_satellite_fulfillment(uuid, public.delivery_method, public.order_timing, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- create_order: mesmo corpo de 20260914120000_delivery_location_source.sql,
-- com 4 mudanças:
--   1) lê fulfillment_location_id e pronta_entrega do payload e, quando
--      fulfillment_location_id vier preenchido, chama
--      private.validate_satellite_fulfillment (pedidos de Pereiro, sem esse
--      campo, não mudam de comportamento).
--   2) no loop de item: pedido de pronta_entrega exige que o produto seja
--      exatamente do local satélite do pedido (lote curado); qualquer outro
--      pedido (Pereiro OU encomenda via um local satélite) exige produto do
--      cardápio normal (fulfillment_location_id null) — o cardápio completo
--      vale pra encomenda em qualquer local, só pronta entrega é exclusiva.
--   3) grava fulfillment_location_id em orders.
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
  v_fulfillment_location_id uuid;
  v_pronta_entrega boolean;
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
