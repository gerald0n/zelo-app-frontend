-- White label — Fase C do ADR-0001: identidade de cliente por tenant.
--
-- Hoje `customers.id` É o `auth.users.id` (mesma PK, FK 1:1) — então o mesmo
-- telefone, cadastrado em duas lojas diferentes, sempre vira a mesma linha
-- em `customers` (busca por `phone_e164` sem `store_id`, e a própria
-- constraint `customers_phone_e164_unique` era global). Isso significa que
-- endereço salvo, nome de cadastro e "dono" de carrinho/pedido de uma loja
-- vazavam pra qualquer outra loja que o mesmo telefone usasse.
--
-- Não dá pra resolver isso trocando a identidade de LOGIN por tenant:
-- `auth.users.phone` e `auth.users.email` têm `unique constraint` GLOBAL no
-- schema do GoTrue (gerenciado pelo Supabase Auth, não por nós) —
-- fisicamente não existe like criar dois `auth.users` com o mesmo telefone,
-- por tenant ou não. O que pode (e deve) ser por tenant é o PERFIL de
-- cliente: `customers` passa a ter `user_id` (a identidade de login,
-- compartilhada) separado de `id` (o perfil, um por loja), com
-- `unique (user_id, store_id)`.

alter table public.customers add column user_id uuid;
update public.customers set user_id = id where user_id is null;
alter table public.customers alter column user_id set not null;

alter table public.customers
  add constraint customers_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.customers drop constraint customers_id_fkey;
alter table public.customers alter column id set default gen_random_uuid();

alter table public.customers drop constraint customers_phone_e164_unique;
alter table public.customers add constraint customers_user_id_store_id_key unique (user_id, store_id);
alter table public.customers add constraint customers_store_id_phone_e164_key unique (store_id, phone_e164);

create index customers_user_id_idx on public.customers (user_id);

-- Resolve o tenant do request atual a partir do header `x-store-id` que o
-- proxy já seta (Fase B). PostgREST expõe automaticamente os headers do
-- request como GUC de sessão (`request.headers`) — sem config extra no
-- projeto. `createServerSupabaseClient()` (packages/shared/src/lib/supabase/
-- server.ts) passou a propagar esse header pro client autenticado, então ele
-- chega até aqui em toda query feita por uma sessão de cliente real.
create or replace function private.request_store_id()
returns uuid
language sql
stable
as $$
  select nullif(
    (current_setting('request.headers', true)::jsonb ->> 'x-store-id'),
    ''
  )::uuid;
$$;

-- current_customer_id() passa a resolver por dois caminhos, sem precisar
-- tocar nas RPCs de impersonação (create_order_as_customer,
-- transition_order_status_as_customer — categoria de função sensível já
-- registrada no ADR, mudança mínima é deliberada):
-- 1. Impersonação de servidor: essas RPCs forçam `request.jwt.claim.sub`
--    pro `customers.id` alvo diretamente (mecanismo que já existia) — esse
--    caminho continua funcionando batendo direto em `customers.id`.
-- 2. Sessão real de cliente: o JWT tem `sub` = `auth.users.id` (`user_id`,
--    a identidade compartilhada) — resolve o perfil da loja atual via
--    `request_store_id()`.
create or replace function private.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce(
    (select c.id from public.customers c where c.id = auth.uid()),
    (
      select c.id from public.customers c
      where c.user_id = auth.uid()
        and c.store_id = private.request_store_id()
    )
  );
$$;

-- private.create_manual_order: a busca de cliente existente por telefone
-- (pra vincular a comanda manual a um cadastro já existente) precisa ser
-- por loja agora — sem isso, com mais de um tenant, o mesmo telefone podia
-- casar com o perfil de outra loja (select sem limit/order, resultado
-- indeterminado entre as linhas). `v_store_id` já é resolvido no topo da
-- função (fatia anterior, `20260917140000`).
create or replace function private.create_manual_order(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, private, extensions
as $$
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
  v_store_lat numeric;
  v_store_lng numeric;
  v_actor_id uuid := auth.uid();
  v_store_id uuid;
begin
  if not private.is_admin() then
    raise exception 'Somente administrador pode criar comanda manual';
  end if;

  v_store_id := private.current_admin_store_id();

  v_guest_phone := nullif(payload->>'guest_phone_e164', '');
  v_guest_name := nullif(payload->>'guest_name', '');
  if v_guest_phone is null or v_guest_name is null then
    raise exception 'Nome e telefone são obrigatórios';
  end if;

  select id into v_customer_id
  from public.customers c
  where c.phone_e164 = v_guest_phone
    and c.store_id = v_store_id;

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

  if v_timing is null then
    raise exception 'timing é obrigatório';
  end if;
  if v_delivery_method is null then
    raise exception 'delivery_method é obrigatório';
  end if;
  if v_payment_method is null then
    raise exception 'payment_method é obrigatório';
  end if;
  if v_payment_method not in ('cash', 'card', 'pix_manual') then
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

  v_order_number := nextval('public.order_number_seq');

  insert into public.orders (
    id,
    order_number,
    customer_id,
    store_id,
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
    customer_note
  ) values (
    v_order_id,
    v_order_number,
    v_customer_id,
    v_store_id,
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
    nullif(payload->>'customer_note', '')
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
$$;
