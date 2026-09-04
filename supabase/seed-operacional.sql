-- ---------------------------------------------------------------------------
-- Seed operacional (L008) — dados da loja para PREVIEW / PRODUÇÃO.
--
-- NÃO roda em `supabase db reset` (config.toml aponta só para seed.sql).
-- Rodar manualmente: Supabase Studio → SQL Editor → colar e executar,
-- no projeto certo (zelo-app-preview OU zelo-app).
--
-- Não inclui admin nem auth.users — isso é criado pelo Studio
-- (Authentication → Add user) + insert em public.admin_profiles.
--
-- Idempotente: usa `on conflict do nothing` nos ids fixos.
--
-- ⚠️ PRODUÇÃO: troque os campos marcados com <<<PREENCHA>>> pelos dados
-- reais antes de executar (telefone, WhatsApp, Pix, endereço, coordenadas).
-- Revise também horários e preços.
-- ---------------------------------------------------------------------------

-- Loja -----------------------------------------------------------------------
insert into public.stores (
  id, name, phone_e164, whatsapp_e164, pix_copy_paste,
  address_line, city, state, postal_code,
  latitude, longitude,
  free_delivery_radius_meters, fixed_delivery_fee_cents, timezone
) values (
  'a0000000-0000-4000-8000-000000000001',
  'Zelo Confeitaria',
  '+5588999999999',        -- <<<PREENCHA>>> telefone E.164
  '+5588999999999',        -- <<<PREENCHA>>> WhatsApp E.164
  '00020126580014BR.GOV.BCB.PIX013614zelo@email.com5204000053039865802BR5920Zelo Confeitaria6008Pereiro62070503***6304ABCD',  -- <<<PREENCHA>>> Pix copia-e-cola real
  'Rua Capitão Bandeira, 115 - Centro',  -- <<<CONFIRME>>> endereço exato
  'Pereiro',
  'CE',
  '63460-000',             -- <<<PREENCHA>>> CEP
  -6.048527,               -- pin no Google Maps (R. Cap. Bandeira, Pereiro-CE)
  -38.461176,              -- pin no Google Maps
  1000,                    -- raio de entrega grátis (m); acima disso R$ fixo até o raio máx (3 km, constante)
  500,
  'America/Fortaleza'
)
on conflict (id) do nothing;

-- Horários (0=domingo … 6=sábado) -------------------------------------------
insert into public.store_business_hours (
  id, store_id, weekday, opens_at, closes_at, is_closed, delivery_enabled, pickup_enabled
) values
  ('a1000000-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000001', 0, null, null, true, false, false),
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 1, '08:00', '18:00', false, true, true),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 2, '08:00', '18:00', false, true, true),
  ('a1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 3, '08:00', '18:00', false, true, true),
  ('a1000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 4, '08:00', '18:00', false, true, true),
  ('a1000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 5, '08:00', '18:00', false, true, true),
  ('a1000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 6, '08:00', '18:00', false, true, true)
on conflict (store_id, weekday) do nothing;

-- Categorias ---------------------------------------------------------------
insert into public.categories (id, name, sort_order, is_active) values
  ('b0000000-0000-4000-8000-000000000001', 'Cookies', 1, true),
  ('b0000000-0000-4000-8000-000000000002', 'Pudins', 2, true),
  ('b0000000-0000-4000-8000-000000000003', 'Empadas', 3, true),
  ('b0000000-0000-4000-8000-000000000004', 'Coxinhas', 4, true)
on conflict (id) do nothing;

-- Produtos ---------------------------------------------------------------
insert into public.products (
  id, category_id, name, slug, description,
  price_cents, weight_min_grams, weight_max_grams, sort_order, is_active, is_available
) values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Cookie Kinder', 'cookie-kinder', 'Cookie artesanal recheado com chocolate Kinder Bueno cremoso, crocante por fora e macio por dentro.', 1200, 120, 120, 1, true, true),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Cookie Nutella', 'cookie-nutella', 'Cookie irresistível com recheio generoso de Nutella derretendo a cada mordida.', 1200, 120, 120, 2, true, true),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'Cookie Brownie', 'cookie-brownie', 'Cookie intenso de chocolate com textura de brownie, crocante nas bordas e cremoso no centro.', 1200, 120, 120, 3, true, true),
  ('c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'Cookie Oreo', 'cookie-oreo', 'Cookie artesanal com pedaços generosos de biscoito Oreo e cream cheese no recheio.', 1200, 120, 120, 4, true, true),
  ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002', 'Mini Pudim', 'mini-pudim', 'Pudim de leite condensado individual, cremoso e com calda de caramelo artesanal.', 800, 120, 120, 1, true, true),
  ('c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000002', 'Pudim 500 g', 'pudim-500g', 'Pudim de leite condensado tradicional, ideal para compartilhar. Calda de caramelo generosa.', 2800, 500, 500, 2, true, true),
  ('c0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000002', 'Pudim 1 kg', 'pudim-1kg', 'Pudim de leite condensado família, perfeito para celebrações. Calda de caramelo abundante.', 4800, 1000, 1000, 3, true, true),
  ('c0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000003', 'Empada de Frango', 'empada-frango', 'Empada caseira com massa amanteigada e recheio cremoso de frango desfiado temperado.', 700, 100, 100, 1, true, true),
  ('c0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000003', 'Empada de Carne de Sol', 'empada-carne-sol', 'Empada caseira com massa amanteigada e recheio suculento de carne de sol com queijo.', 800, 100, 100, 2, true, true),
  ('c0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000004', 'Coxinha de Frango', 'coxinha-frango', 'Coxinha crocante com recheio de frango desfiado e cream cheese artesanal.', 600, 150, 160, 1, true, true),
  ('c0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000004', 'Coxinha de Carne de Sol', 'coxinha-carne-sol', 'Coxinha crocante com recheio de carne de sol suculenta e queijo coalho.', 700, 150, 160, 2, true, true),
  ('c0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000004', 'Coxinha de Frango c/ Catupiry', 'coxinha-frango-catupiry', 'Coxinha com frango desfiado e catupiry cremoso. Combinação clássica irresistível.', 700, 165, 175, 3, true, true),
  ('c0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000004', 'Coxinha de Carne de Sol c/ Catupiry', 'coxinha-carne-sol-catupiry', 'Coxinha com carne de sol e catupiry. Sabor nordestino com cremosidade incomparável.', 800, 165, 175, 4, true, true)
on conflict (id) do nothing;

-- Adicionais -------------------------------------------------------------
insert into public.add_ons (id, name, description, price_cents, is_active, is_available) values
  ('d0000000-0000-4000-8000-000000000001', 'Gotas de chocolate extra', null, 200, true, true),
  ('d0000000-0000-4000-8000-000000000002', 'Nutella extra', null, 300, true, true)
on conflict (id) do nothing;

insert into public.product_add_ons (product_id, add_on_id, sort_order) values
  ('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 1),
  ('c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 1)
on conflict (product_id, add_on_id) do nothing;
