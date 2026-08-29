-- Migration inicial: schema Zelo (Fase B)
-- Convenções: UUID PK, money em centavos, timestamptz, RLS em todas as tabelas public.

-- ---------------------------------------------------------------------------
-- Extensões
-- ---------------------------------------------------------------------------
create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- Resolve gen_random_uuid / citext durante a migration
set search_path to public, extensions;

-- Schema interno (não exposto pela API)
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to postgres, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- auth.uid() do cliente autenticado
create or replace function private.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public, private
as $$
  select auth.uid();
$$;

revoke all on function private.current_customer_id() from public;
grant execute on function private.current_customer_id() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.order_status as enum (
  'received',
  'confirmed',
  'in_production',
  'ready_for_delivery',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'cancelled'
);

create type public.delivery_method as enum (
  'delivery',
  'pickup'
);

create type public.payment_method as enum (
  'pix',
  'cash',
  'card'
);

create type public.payment_status as enum (
  'pending',
  'confirmed',
  'failed',
  'cancelled'
);

create type public.order_timing as enum (
  'immediate',
  'scheduled'
);

create type public.status_change_actor_type as enum (
  'customer',
  'admin',
  'system'
);

-- ---------------------------------------------------------------------------
-- Sequência de pedidos
-- ---------------------------------------------------------------------------
create sequence public.order_number_seq start with 1000 increment by 1;

-- ---------------------------------------------------------------------------
-- Tabelas de loja / catálogo / usuários
-- ---------------------------------------------------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_e164 text not null,
  whatsapp_e164 text not null,
  pix_copy_paste text,
  address_line text not null,
  city text not null,
  state text not null,
  postal_code text,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  free_delivery_radius_meters integer not null default 2000,
  fixed_delivery_fee_cents integer not null default 500,
  timezone text not null default 'America/Fortaleza',
  is_open_override boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_free_delivery_radius_nonneg
    check (free_delivery_radius_meters >= 0),
  constraint stores_fixed_delivery_fee_nonneg
    check (fixed_delivery_fee_cents >= 0),
  constraint stores_timezone_not_empty
    check (length(trim(timezone)) > 0)
);

create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

create table public.store_business_hours (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  weekday smallint not null,
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  delivery_enabled boolean not null default true,
  pickup_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_business_hours_weekday_range
    check (weekday between 0 and 6),
  constraint store_business_hours_open_window
    check (
      is_closed
      or (
        opens_at is not null
        and closes_at is not null
        and opens_at < closes_at
      )
    ),
  constraint store_business_hours_store_weekday_unique unique (store_id, weekday)
);

create trigger store_business_hours_set_updated_at
  before update on public.store_business_hours
  for each row execute function public.set_updated_at();

create table public.store_blackout_periods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint store_blackout_periods_range
    check (ends_at > starts_at)
);

create table public.admin_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger admin_profiles_set_updated_at
  before update on public.admin_profiles
  for each row execute function public.set_updated_at();

-- Depende de admin_profiles
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.admin_profiles ap
    where ap.id = auth.uid()
      and ap.is_active = true
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated, service_role;

create table public.customers (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  phone_e164 text not null,
  email citext,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_name_not_empty check (length(trim(name)) > 0),
  constraint customers_phone_e164_unique unique (phone_e164)
);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  label text,
  street text not null,
  number text not null,
  neighborhood text not null,
  city text not null,
  state text not null,
  postal_code text,
  complement text,
  reference_point text,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  is_default boolean not null default false,
  last_used_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customer_addresses_set_updated_at
  before update on public.customer_addresses
  for each row execute function public.set_updated_at();

-- Um endereço padrão ativo por cliente
create unique index customer_addresses_one_default_idx
  on public.customer_addresses (customer_id)
  where is_default and archived_at is null;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id),
  name text not null,
  slug text not null,
  description text,
  price_cents integer not null,
  weight_min_grams integer,
  weight_max_grams integer,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_available boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_slug_unique unique (slug),
  constraint products_price_nonneg check (price_cents >= 0),
  constraint products_weight_min_positive
    check (weight_min_grams is null or weight_min_grams > 0),
  constraint products_weight_max_positive
    check (weight_max_grams is null or weight_max_grams > 0),
  constraint products_weight_range
    check (
      weight_min_grams is null
      or weight_max_grams is null
      or weight_max_grams >= weight_min_grams
    )
);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  alt_text text not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index product_images_one_primary_idx
  on public.product_images (product_id)
  where is_primary;

create table public.add_ons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_cents integer not null,
  is_active boolean not null default true,
  is_available boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint add_ons_price_nonneg check (price_cents >= 0)
);

create trigger add_ons_set_updated_at
  before update on public.add_ons
  for each row execute function public.set_updated_at();

create table public.product_add_ons (
  product_id uuid not null references public.products (id) on delete cascade,
  add_on_id uuid not null references public.add_ons (id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (product_id, add_on_id)
);

-- orders antes de carts (carts.source_order_id → orders)
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint not null default nextval('public.order_number_seq'),
  customer_id uuid not null references public.customers (id),
  status public.order_status not null default 'received',
  timing public.order_timing not null,
  scheduled_for timestamptz,
  delivery_method public.delivery_method not null,
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'pending',
  subtotal_cents integer not null,
  add_ons_total_cents integer not null,
  delivery_fee_cents integer not null,
  total_cents integer not null,
  needs_change boolean,
  change_for_amount_cents integer,
  customer_note text,
  internal_note text,
  source_order_id uuid references public.orders (id),
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_order_number_unique unique (order_number),
  constraint orders_amounts_nonneg check (
    subtotal_cents >= 0
    and add_ons_total_cents >= 0
    and delivery_fee_cents >= 0
    and total_cents >= 0
  ),
  constraint orders_total_consistent check (
    total_cents = subtotal_cents + add_ons_total_cents + delivery_fee_cents
  ),
  constraint orders_scheduled_requires_datetime check (
    timing <> 'scheduled' or scheduled_for is not null
  ),
  constraint orders_change_amount_valid check (
    needs_change is not true
    or (
      change_for_amount_cents is not null
      and change_for_amount_cents >= total_cents
    )
  ),
  constraint orders_cancelled_requires_reason check (
    status <> 'cancelled'
    or (
      cancellation_reason is not null
      and length(trim(cancellation_reason)) > 0
    )
  )
);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

alter sequence public.order_number_seq owned by public.orders.order_number;

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete cascade,
  anonymous_key uuid,
  source_order_id uuid references public.orders (id),
  expires_at timestamptz not null,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carts_owner_present check (
    customer_id is not null or anonymous_key is not null
  )
);

create trigger carts_set_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity integer not null,
  customer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_quantity_positive check (quantity > 0)
);

create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

create table public.cart_item_add_ons (
  cart_item_id uuid not null references public.cart_items (id) on delete cascade,
  add_on_id uuid not null references public.add_ons (id),
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (cart_item_id, add_on_id),
  constraint cart_item_add_ons_quantity_positive check (quantity > 0)
);

create table public.order_addresses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  street text not null,
  number text not null,
  neighborhood text not null,
  city text not null,
  state text not null,
  postal_code text,
  complement text,
  reference_point text,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  route_distance_meters integer not null,
  delivery_fee_cents integer not null,
  created_at timestamptz not null default now(),
  constraint order_addresses_distance_nonneg check (route_distance_meters >= 0),
  constraint order_addresses_fee_nonneg check (delivery_fee_cents >= 0)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id),
  product_name text not null,
  product_description text,
  unit_price_cents integer not null,
  quantity integer not null,
  weight_min_grams integer,
  weight_max_grams integer,
  customer_note text,
  line_total_cents integer not null,
  created_at timestamptz not null default now(),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_unit_price_nonneg check (unit_price_cents >= 0),
  constraint order_items_line_total_nonneg check (line_total_cents >= 0)
);

create table public.order_item_add_ons (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  add_on_id uuid references public.add_ons (id),
  add_on_name text not null,
  unit_price_cents integer not null,
  quantity integer not null,
  line_total_cents integer not null,
  created_at timestamptz not null default now(),
  constraint order_item_add_ons_quantity_positive check (quantity > 0),
  constraint order_item_add_ons_unit_price_nonneg check (unit_price_cents >= 0),
  constraint order_item_add_ons_line_total_nonneg check (line_total_cents >= 0)
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  previous_status public.order_status,
  new_status public.order_status not null,
  actor_type public.status_change_actor_type not null,
  actor_id uuid,
  reason text,
  created_at timestamptz not null default now(),
  constraint order_status_history_cancel_reason check (
    new_status <> 'cancelled'
    or (reason is not null and length(trim(reason)) > 0)
  )
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_unique unique (endpoint)
);

create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type public.status_change_actor_type not null,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create index customers_phone_e164_idx on public.customers (phone_e164);
create index customer_addresses_customer_archived_idx
  on public.customer_addresses (customer_id, archived_at);
create index products_catalog_idx
  on public.products (category_id, is_active, is_available, archived_at);
create index product_images_product_sort_idx
  on public.product_images (product_id, sort_order);
create index product_add_ons_product_idx on public.product_add_ons (product_id);
create index carts_customer_expires_idx on public.carts (customer_id, expires_at);
create index carts_anonymous_expires_idx on public.carts (anonymous_key, expires_at);
create index cart_items_cart_idx on public.cart_items (cart_id);
create index orders_customer_created_idx on public.orders (customer_id, created_at desc);
create index orders_status_scheduled_idx on public.orders (status, scheduled_for);
create index orders_order_number_idx on public.orders (order_number);
create index orders_created_at_idx on public.orders (created_at desc);
create index order_items_order_idx on public.order_items (order_id);
create index order_status_history_order_created_idx
  on public.order_status_history (order_id, created_at);
create index push_subscriptions_customer_revoked_idx
  on public.push_subscriptions (customer_id, revoked_at);

-- ---------------------------------------------------------------------------
-- Funções transacionais (private) + wrappers public
-- ---------------------------------------------------------------------------
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
      and p.is_active = true;

    if not found then
      raise exception 'Produto inválido: %', v_item->>'product_id';
    end if;

    if not v_product.is_available then
      raise exception 'Produto indisponível: %', v_product.name;
    end if;

    v_line_product := v_product.price_cents * v_qty;
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
      v_product.price_cents,
      v_qty,
      v_product.weight_min_grams,
      v_product.weight_max_grams,
      nullif(v_item->>'customer_note', ''),
      (v_product.price_cents + v_line_addons) * v_qty
    );

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

revoke all on function private.create_order(jsonb) from public;

create or replace function public.create_order(payload jsonb)
returns uuid
language sql
security definer
set search_path = public, private, extensions
as $$
  select private.create_order(payload);
$$;

revoke all on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to authenticated;

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

revoke all on function private.transition_order_status(
  uuid, public.order_status, public.status_change_actor_type, text
) from public;

create or replace function public.transition_order_status(
  p_order_id uuid,
  p_new_status public.order_status,
  p_actor_type public.status_change_actor_type,
  p_reason text default null
)
returns public.orders
language sql
security definer
set search_path = public, private, extensions
as $$
  select private.transition_order_status(
    p_order_id,
    p_new_status,
    p_actor_type,
    p_reason
  );
$$;

revoke all on function public.transition_order_status(
  uuid, public.order_status, public.status_change_actor_type, text
) from public;
grant execute on function public.transition_order_status(
  uuid, public.order_status, public.status_change_actor_type, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Grants de tabela (API Data sem auto-expose)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select on public.stores to anon, authenticated;
grant select, update on public.stores to authenticated;

grant select on public.store_business_hours to anon, authenticated;
grant select, insert, update, delete on public.store_business_hours to authenticated;

grant select on public.store_blackout_periods to anon, authenticated;
grant select, insert, update, delete on public.store_blackout_periods to authenticated;

grant select on public.admin_profiles to authenticated;
grant select, update on public.admin_profiles to authenticated;

grant select, insert, update on public.customers to authenticated;

grant select, insert, update, delete on public.customer_addresses to authenticated;

grant select on public.categories to anon, authenticated;
grant select, insert, update, delete on public.categories to authenticated;

grant select on public.products to anon, authenticated;
grant select, insert, update, delete on public.products to authenticated;

grant select on public.product_images to anon, authenticated;
grant select, insert, update, delete on public.product_images to authenticated;

grant select on public.add_ons to anon, authenticated;
grant select, insert, update, delete on public.add_ons to authenticated;

grant select on public.product_add_ons to anon, authenticated;
grant select, insert, update, delete on public.product_add_ons to authenticated;

grant select, insert, update, delete on public.carts to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;
grant select, insert, update, delete on public.cart_item_add_ons to authenticated;

grant select on public.orders to authenticated;
grant select, update on public.orders to authenticated;

grant select on public.order_addresses to authenticated;
grant select on public.order_items to authenticated;
grant select on public.order_item_add_ons to authenticated;
grant select on public.order_status_history to authenticated;

grant select, insert, update, delete on public.push_subscriptions to authenticated;

grant select on public.audit_logs to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.stores enable row level security;
alter table public.store_business_hours enable row level security;
alter table public.store_blackout_periods enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.add_ons enable row level security;
alter table public.product_add_ons enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.cart_item_add_ons enable row level security;
alter table public.orders enable row level security;
alter table public.order_addresses enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_add_ons enable row level security;
alter table public.order_status_history enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.audit_logs enable row level security;

-- stores
create policy stores_public_read
  on public.stores for select
  to anon, authenticated
  using (true);

create policy stores_admin_manage
  on public.stores for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- store_business_hours
create policy store_business_hours_public_read
  on public.store_business_hours for select
  to anon, authenticated
  using (true);

create policy store_business_hours_admin_manage
  on public.store_business_hours for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- store_blackout_periods
create policy store_blackout_periods_public_read
  on public.store_blackout_periods for select
  to anon, authenticated
  using (true);

create policy store_blackout_periods_admin_manage
  on public.store_blackout_periods for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- admin_profiles
create policy admin_profiles_admin_select
  on public.admin_profiles for select
  to authenticated
  using (private.is_admin());

create policy admin_profiles_admin_update
  on public.admin_profiles for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- customers
create policy customers_select_own
  on public.customers for select
  to authenticated
  using (id = private.current_customer_id() or private.is_admin());

create policy customers_insert_own
  on public.customers for insert
  to authenticated
  with check (id = private.current_customer_id());

create policy customers_update_own
  on public.customers for update
  to authenticated
  using (id = private.current_customer_id() or private.is_admin())
  with check (id = private.current_customer_id() or private.is_admin());

-- customer_addresses
create policy customer_addresses_select_own
  on public.customer_addresses for select
  to authenticated
  using (customer_id = private.current_customer_id() or private.is_admin());

create policy customer_addresses_insert_own
  on public.customer_addresses for insert
  to authenticated
  with check (customer_id = private.current_customer_id());

create policy customer_addresses_update_own
  on public.customer_addresses for update
  to authenticated
  using (customer_id = private.current_customer_id() or private.is_admin())
  with check (customer_id = private.current_customer_id() or private.is_admin());

create policy customer_addresses_delete_own
  on public.customer_addresses for delete
  to authenticated
  using (customer_id = private.current_customer_id() or private.is_admin());

-- categories (catálogo publicado)
create policy categories_public_read
  on public.categories for select
  to anon, authenticated
  using (
    private.is_admin()
    or (is_active = true and archived_at is null)
  );

create policy categories_admin_manage
  on public.categories for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- products
create policy products_public_read
  on public.products for select
  to anon, authenticated
  using (
    private.is_admin()
    or (is_active = true and archived_at is null)
  );

create policy products_admin_manage
  on public.products for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- product_images
create policy product_images_public_read
  on public.product_images for select
  to anon, authenticated
  using (
    private.is_admin()
    or exists (
      select 1
      from public.products p
      where p.id = product_images.product_id
        and p.is_active = true
        and p.archived_at is null
    )
  );

create policy product_images_admin_manage
  on public.product_images for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- add_ons
create policy add_ons_public_read
  on public.add_ons for select
  to anon, authenticated
  using (
    private.is_admin()
    or (is_active = true and archived_at is null)
  );

create policy add_ons_admin_manage
  on public.add_ons for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- product_add_ons
create policy product_add_ons_public_read
  on public.product_add_ons for select
  to anon, authenticated
  using (
    private.is_admin()
    or exists (
      select 1
      from public.products p
      join public.add_ons a on a.id = product_add_ons.add_on_id
      where p.id = product_add_ons.product_id
        and p.is_active = true
        and p.archived_at is null
        and a.is_active = true
        and a.archived_at is null
    )
  );

create policy product_add_ons_admin_manage
  on public.product_add_ons for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- carts
create policy carts_select_own
  on public.carts for select
  to authenticated
  using (customer_id = private.current_customer_id() or private.is_admin());

create policy carts_insert_own
  on public.carts for insert
  to authenticated
  with check (customer_id = private.current_customer_id());

create policy carts_update_own
  on public.carts for update
  to authenticated
  using (customer_id = private.current_customer_id() or private.is_admin())
  with check (customer_id = private.current_customer_id() or private.is_admin());

create policy carts_delete_own
  on public.carts for delete
  to authenticated
  using (customer_id = private.current_customer_id() or private.is_admin());

-- cart_items
create policy cart_items_select_own
  on public.cart_items for select
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and c.customer_id = private.current_customer_id()
    )
  );

create policy cart_items_insert_own
  on public.cart_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and c.customer_id = private.current_customer_id()
    )
  );

create policy cart_items_update_own
  on public.cart_items for update
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and c.customer_id = private.current_customer_id()
    )
  )
  with check (
    private.is_admin()
    or exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and c.customer_id = private.current_customer_id()
    )
  );

create policy cart_items_delete_own
  on public.cart_items for delete
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and c.customer_id = private.current_customer_id()
    )
  );

-- cart_item_add_ons
create policy cart_item_add_ons_select_own
  on public.cart_item_add_ons for select
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1
      from public.cart_items ci
      join public.carts c on c.id = ci.cart_id
      where ci.id = cart_item_add_ons.cart_item_id
        and c.customer_id = private.current_customer_id()
    )
  );

create policy cart_item_add_ons_insert_own
  on public.cart_item_add_ons for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.cart_items ci
      join public.carts c on c.id = ci.cart_id
      where ci.id = cart_item_add_ons.cart_item_id
        and c.customer_id = private.current_customer_id()
    )
  );

create policy cart_item_add_ons_update_own
  on public.cart_item_add_ons for update
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1
      from public.cart_items ci
      join public.carts c on c.id = ci.cart_id
      where ci.id = cart_item_add_ons.cart_item_id
        and c.customer_id = private.current_customer_id()
    )
  )
  with check (
    private.is_admin()
    or exists (
      select 1
      from public.cart_items ci
      join public.carts c on c.id = ci.cart_id
      where ci.id = cart_item_add_ons.cart_item_id
        and c.customer_id = private.current_customer_id()
    )
  );

create policy cart_item_add_ons_delete_own
  on public.cart_item_add_ons for delete
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1
      from public.cart_items ci
      join public.carts c on c.id = ci.cart_id
      where ci.id = cart_item_add_ons.cart_item_id
        and c.customer_id = private.current_customer_id()
    )
  );

-- orders (leitura; escrita via funções)
create policy orders_select_own
  on public.orders for select
  to authenticated
  using (customer_id = private.current_customer_id() or private.is_admin());

create policy orders_admin_update
  on public.orders for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- order_addresses
create policy order_addresses_select_own
  on public.order_addresses for select
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_addresses.order_id
        and o.customer_id = private.current_customer_id()
    )
  );

-- order_items
create policy order_items_select_own
  on public.order_items for select
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.customer_id = private.current_customer_id()
    )
  );

-- order_item_add_ons
create policy order_item_add_ons_select_own
  on public.order_item_add_ons for select
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_add_ons.order_item_id
        and o.customer_id = private.current_customer_id()
    )
  );

-- order_status_history
create policy order_status_history_select_own
  on public.order_status_history for select
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and o.customer_id = private.current_customer_id()
    )
  );

-- push_subscriptions
create policy push_subscriptions_select_own
  on public.push_subscriptions for select
  to authenticated
  using (customer_id = private.current_customer_id() or private.is_admin());

create policy push_subscriptions_insert_own
  on public.push_subscriptions for insert
  to authenticated
  with check (customer_id = private.current_customer_id());

create policy push_subscriptions_update_own
  on public.push_subscriptions for update
  to authenticated
  using (customer_id = private.current_customer_id() or private.is_admin())
  with check (customer_id = private.current_customer_id() or private.is_admin());

create policy push_subscriptions_delete_own
  on public.push_subscriptions for delete
  to authenticated
  using (customer_id = private.current_customer_id() or private.is_admin());

-- audit_logs
create policy audit_logs_admin_select
  on public.audit_logs for select
  to authenticated
  using (private.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: bucket product-images
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy product_images_storage_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy product_images_storage_admin_insert
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and private.is_admin());

create policy product_images_storage_admin_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and private.is_admin())
  with check (bucket_id = 'product-images' and private.is_admin());

create policy product_images_storage_admin_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and private.is_admin());
