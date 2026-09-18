-- Seed Zelo: loja, horários, catálogo e administrador.
-- Admin: admin@zeloconfeitaria.com.br / admin123

-- IDs fixos para reprodutibilidade
-- store:        a0000000-0000-4000-8000-000000000001
-- categories:   b0000000-0000-4000-8000-00000000000{1..5} (5 = Pizzas)
-- products:     c0000000-0000-4000-8000-0000000000{01..13}; pizzas 14..23
-- add_ons:      d0000000-0000-4000-8000-00000000000{1..2}
-- pizza_addons: e0000000-0000-4000-8000-00000000000{1..4}

insert into public.stores (
  id,
  name,
  phone_e164,
  whatsapp_e164,
  pix_copy_paste,
  address_line,
  city,
  state,
  postal_code,
  latitude,
  longitude,
  free_delivery_radius_meters,
  max_delivery_radius_meters,
  fixed_delivery_fee_cents,
  timezone,
  domain,
  logo_url
) values (
  'a0000000-0000-4000-8000-000000000001',
  'Zelo Confeitaria',
  '+5588999999999',
  '+5588999999999',
  '00020126580014BR.GOV.BCB.PIX013614zelo@email.com5204000053039865802BR5920Zelo Confeitaria6008Pereiro62070503***6304ABCD',
  'Rua Capitão Bandeira, 115 – Centro',
  'Pereiro',
  'CE',
  '63460-000',
  -6.048527,
  -38.461176,
  1000,
  3000,
  500,
  'America/Fortaleza',
  -- domínio de teste local (não o real de produção) — exercita o caminho de
  -- match exato do resolver (Fase B) se você apontar esse host pra 127.0.0.1
  -- no /etc/hosts; acessar por "localhost" continua caindo no fallback.
  'zelo.local.test',
  '/brand/zelo-selo.png'
);

-- weekday: 0=domingo … 6=sábado
insert into public.store_business_hours (
  id,
  store_id,
  weekday,
  opens_at,
  closes_at,
  is_closed,
  delivery_enabled,
  pickup_enabled
) values
  ('a1000000-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000001', 0, null, null, true, false, false),
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 1, '08:00', '18:00', false, true, true),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 2, '08:00', '18:00', false, true, true),
  ('a1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 3, '08:00', '18:00', false, true, true),
  ('a1000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 4, '08:00', '18:00', false, true, true),
  ('a1000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 5, '08:00', '18:00', false, true, true),
  ('a1000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 6, '08:00', '18:00', false, true, true);

insert into public.categories (
  id, name, sort_order, is_active,
  scheduling_allow_same_day, scheduling_same_day_lead_minutes,
  scheduling_weekday_earliest, scheduling_weekend_earliest,
  scheduling_slot_interval_minutes
) values
  ('b0000000-0000-4000-8000-000000000001', 'Cookies', 1, true, true, 120, null, null, 30),
  ('b0000000-0000-4000-8000-000000000002', 'Pudins', 2, true, false, 120, '17:00', '10:00', 60),
  ('b0000000-0000-4000-8000-000000000003', 'Empadas', 3, true, true, 120, null, null, 30),
  ('b0000000-0000-4000-8000-000000000004', 'Coxinhas', 4, true, true, 120, null, null, 30),
  ('b0000000-0000-4000-8000-000000000005', 'Pizzas', 5, true, true, 120, null, null, 30);

insert into public.products (
  id,
  category_id,
  name,
  slug,
  description,
  price_cents,
  weight_min_grams,
  weight_max_grams,
  sort_order,
  is_active,
  is_available,
  product_type
) values
  (
    'c0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    'Cookie Kinder',
    'cookie-kinder',
    'Cookie artesanal recheado com chocolate Kinder Bueno cremoso, crocante por fora e macio por dentro.',
    1200, 120, 120, 1, true, true, 'standard'
  ),
  (
    'c0000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000001',
    'Cookie Nutella',
    'cookie-nutella',
    'Cookie irresistível com recheio generoso de Nutella derretendo a cada mordida.',
    1200, 120, 120, 2, true, true, 'standard'
  ),
  (
    'c0000000-0000-4000-8000-000000000003',
    'b0000000-0000-4000-8000-000000000001',
    'Cookie Brownie',
    'cookie-brownie',
    'Cookie intenso de chocolate com textura de brownie, crocante nas bordas e cremoso no centro.',
    1200, 120, 120, 3, true, true, 'standard'
  ),
  (
    'c0000000-0000-4000-8000-000000000004',
    'b0000000-0000-4000-8000-000000000001',
    'Cookie Oreo',
    'cookie-oreo',
    'Cookie artesanal com pedaços generosos de biscoito Oreo e cream cheese no recheio.',
    1200, 120, 120, 4, true, true, 'standard'
  ),
  (
    'c0000000-0000-4000-8000-000000000005',
    'b0000000-0000-4000-8000-000000000002',
    'Mini Pudim',
    'mini-pudim',
    'Pudim de leite condensado individual, cremoso e com calda de caramelo artesanal.',
    800, 120, 120, 1, true, true, 'standard'
  ),
  (
    'c0000000-0000-4000-8000-000000000006',
    'b0000000-0000-4000-8000-000000000002',
    'Pudim 500 g',
    'pudim-500g',
    'Pudim de leite condensado tradicional, ideal para compartilhar. Calda de caramelo generosa.',
    2800, 500, 500, 2, true, true, 'standard'
  ),
  (
    'c0000000-0000-4000-8000-000000000007',
    'b0000000-0000-4000-8000-000000000002',
    'Pudim 1 kg',
    'pudim-1kg',
    'Pudim de leite condensado família, perfeito para celebrações. Calda de caramelo abundante.',
    4800, 1000, 1000, 3, true, true, 'standard'
  ),
  (
    'c0000000-0000-4000-8000-000000000008',
    'b0000000-0000-4000-8000-000000000003',
    'Empada de Frango',
    'empada-frango',
    'Empada caseira com massa amanteigada e recheio cremoso de frango desfiado temperado.',
    700, 100, 100, 1, true, true, 'standard'
  ),
  (
    'c0000000-0000-4000-8000-000000000009',
    'b0000000-0000-4000-8000-000000000003',
    'Empada de Carne de Sol',
    'empada-carne-sol',
    'Empada caseira com massa amanteigada e recheio suculento de carne de sol com queijo.',
    800, 100, 100, 2, true, true, 'standard'
  ),
  (
    'c0000000-0000-4000-8000-000000000010',
    'b0000000-0000-4000-8000-000000000004',
    'Coxinha de Frango',
    'coxinha-frango',
    'Coxinha crocante com recheio de frango desfiado e cream cheese artesanal.',
    600, 150, 160, 1, true, true, 'standard'
  ),
  (
    'c0000000-0000-4000-8000-000000000011',
    'b0000000-0000-4000-8000-000000000004',
    'Coxinha de Carne de Sol',
    'coxinha-carne-sol',
    'Coxinha crocante com recheio de carne de sol suculenta e queijo coalho.',
    700, 150, 160, 2, true, true, 'standard'
  ),
  (
    'c0000000-0000-4000-8000-000000000012',
    'b0000000-0000-4000-8000-000000000004',
    'Coxinha de Frango c/ Catupiry',
    'coxinha-frango-catupiry',
    'Coxinha com frango desfiado e catupiry cremoso. Combinação clássica irresistível.',
    700, 165, 175, 3, true, true, 'standard'
  ),
  (
    'c0000000-0000-4000-8000-000000000013',
    'b0000000-0000-4000-8000-000000000004',
    'Coxinha de Carne de Sol c/ Catupiry',
    'coxinha-carne-sol-catupiry',
    'Coxinha com carne de sol e catupiry. Sabor nordestino com cremosidade incomparável.',
    800, 165, 175, 4, true, true, 'standard'
  ),
  (
    'c0000000-0000-4000-8000-000000000014',
    'b0000000-0000-4000-8000-000000000005',
    'Calabresa',
    'pizza-calabresa',
    'Molho, mussarela, calabresa e cebola.',
    0, null, null, 1, true, true, 'pizza_flavor'
  ),
  (
    'c0000000-0000-4000-8000-000000000015',
    'b0000000-0000-4000-8000-000000000005',
    'Mussarela',
    'pizza-mussarela',
    'Molho, mussarela e tomate.',
    0, null, null, 2, true, true, 'pizza_flavor'
  ),
  (
    'c0000000-0000-4000-8000-000000000016',
    'b0000000-0000-4000-8000-000000000005',
    'Frango com Catupiry',
    'pizza-frango-catupiry',
    'Molho, mussarela, frango e catupiry.',
    0, null, null, 3, true, true, 'pizza_flavor'
  ),
  (
    'c0000000-0000-4000-8000-000000000017',
    'b0000000-0000-4000-8000-000000000005',
    'Peito de Peru',
    'pizza-peito-peru',
    'Molho, mussarela, cream cheese, peito de peru, bacon, alho poró e parmesão.',
    0, null, null, 10, true, true, 'pizza_flavor'
  ),
  (
    'c0000000-0000-4000-8000-000000000018',
    'b0000000-0000-4000-8000-000000000005',
    'Mista',
    'pizza-mista',
    'Molho, presunto e mussarela.',
    0, null, null, 4, true, true, 'pizza_flavor'
  ),
  (
    'c0000000-0000-4000-8000-000000000019',
    'b0000000-0000-4000-8000-000000000005',
    'Frango',
    'pizza-frango',
    'Molho, mussarela e frango.',
    0, null, null, 5, true, true, 'pizza_flavor'
  ),
  (
    'c0000000-0000-4000-8000-000000000020',
    'b0000000-0000-4000-8000-000000000005',
    'Carne de Sol',
    'pizza-carne-de-sol',
    'Molho, mussarela, carne de sol e cebola roxa.',
    0, null, null, 6, true, true, 'pizza_flavor'
  ),
  (
    'c0000000-0000-4000-8000-000000000021',
    'b0000000-0000-4000-8000-000000000005',
    'Nordestina',
    'pizza-nordestina',
    'Molho, mussarela, cream cheese, carne de sol e queijo coalho.',
    0, null, null, 7, true, true, 'pizza_flavor'
  ),
  (
    'c0000000-0000-4000-8000-000000000022',
    'b0000000-0000-4000-8000-000000000005',
    'Lombo Canadense',
    'pizza-lombo-canadense',
    'Molho, mussarela, lombo canadense e catupiry.',
    0, null, null, 8, true, true, 'pizza_flavor'
  ),
  (
    'c0000000-0000-4000-8000-000000000023',
    'b0000000-0000-4000-8000-000000000005',
    'Arretada',
    'pizza-arretada',
    'Molho, mussarela, calabresa, queijo coalho e bacon.',
    0, null, null, 9, true, true, 'pizza_flavor'
  );

-- Preço de cada sabor no tamanho G (único tamanho ativo no lançamento).
insert into public.pizza_flavor_prices (product_id, size_id, price_cents)
select v.product_id, ps.id, v.price_cents
from (values
  ('c0000000-0000-4000-8000-000000000014'::uuid, 4500),
  ('c0000000-0000-4000-8000-000000000015'::uuid, 4500),
  ('c0000000-0000-4000-8000-000000000016'::uuid, 5500),
  ('c0000000-0000-4000-8000-000000000017'::uuid, 7400),
  ('c0000000-0000-4000-8000-000000000018'::uuid, 4500),
  ('c0000000-0000-4000-8000-000000000019'::uuid, 4500),
  ('c0000000-0000-4000-8000-000000000020'::uuid, 4500),
  ('c0000000-0000-4000-8000-000000000021'::uuid, 6000),
  ('c0000000-0000-4000-8000-000000000022'::uuid, 7000),
  ('c0000000-0000-4000-8000-000000000023'::uuid, 7000)
) as v(product_id, price_cents)
cross join lateral (select id from public.pizza_sizes where name = 'G') as ps;

insert into public.pizza_addons (id, name, description, price_half_cents, price_full_cents, sort_order) values
  ('e0000000-0000-4000-8000-000000000001', 'Catupiry', null, 800, 1500, 1),
  ('e0000000-0000-4000-8000-000000000002', 'Bacon', null, 400, 800, 2),
  ('e0000000-0000-4000-8000-000000000003', 'Cream Cheese', null, 750, 1500, 3),
  ('e0000000-0000-4000-8000-000000000004', 'Alho Poró', null, 250, 500, 4);

insert into public.add_ons (
  id,
  name,
  description,
  price_cents,
  is_active,
  is_available
) values
  (
    'd0000000-0000-4000-8000-000000000001',
    'Gotas de chocolate extra',
    null,
    200,
    true,
    true
  ),
  (
    'd0000000-0000-4000-8000-000000000002',
    'Nutella extra',
    null,
    300,
    true,
    true
  );

insert into public.product_add_ons (product_id, add_on_id, sort_order) values
  ('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 1),
  ('c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 1);

-- Administrador (I001): admin@zeloconfeitaria.com.br / admin123
-- id fixo: f0000000-0000-4000-8000-000000000001
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  'f0000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'admin@zeloconfeitaria.com.br',
  crypt('admin123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Admin Zelo"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
);

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  'f0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'sub', 'f0000000-0000-4000-8000-000000000001',
    'email', 'admin@zeloconfeitaria.com.br',
    'email_verified', true
  ),
  'email',
  'f0000000-0000-4000-8000-000000000001',
  now(),
  now(),
  now()
);

insert into public.admin_profiles (id, display_name, is_active)
values (
  'f0000000-0000-4000-8000-000000000001',
  'Admin Zelo',
  true
);

-- White label (ADR-0001, Fase 0'): backfill de store_id em dev local.
--
-- Migrations rodam antes deste seed, então a migration de backfill
-- (20260916190100) não encontra loja e não faz nada. Aqui a loja já existe
-- (inserida acima), então fechamos a lacuna: tudo que ficou com store_id
-- nulo — tanto o que este seed acabou de inserir (categories, products,
-- add_ons, admin_profiles, pizza_flavor_prices, pizza_addons) quanto o que
-- já vinha de migrations anteriores sem essa coluna (satellite_locations,
-- pizza_sizes) — recebe o id da loja Zelo local.
do $$
declare
  v_store_id uuid := 'a0000000-0000-4000-8000-000000000001';
begin
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

