-- White label — Fase 0'/A (ADR-0001): introduz o conceito de tenant.
--
-- Duas coisas nesta migration, sempre aditivas e nullable (zero mudança de
-- comportamento para a Zelo real, que continua sendo a única loja até o
-- backfill + Fase C ligarem o scoping de verdade):
--
-- 1. `store_id` nas tabelas "raiz" de negócio (hoje implicitamente ligadas a
--    uma loja só). Tabelas filhas (product_images, order_items, cart_items,
--    etc.) ficam de fora — herdam o tenant via join na tabela raiz, isso é
--    trabalho de RLS na Fase C, não de schema aqui.
-- 2. Colunas de branding/config por tenant em `stores` (Fase A do ADR-0001):
--    domínio, tema, logo, fontes e feature flags.

alter table public.categories add column if not exists store_id uuid references public.stores (id);
alter table public.products add column if not exists store_id uuid references public.stores (id);
alter table public.add_ons add column if not exists store_id uuid references public.stores (id);
alter table public.customers add column if not exists store_id uuid references public.stores (id);
alter table public.orders add column if not exists store_id uuid references public.stores (id);
alter table public.carts add column if not exists store_id uuid references public.stores (id);
alter table public.coupons add column if not exists store_id uuid references public.stores (id);
alter table public.promotions add column if not exists store_id uuid references public.stores (id);
alter table public.satellite_locations add column if not exists store_id uuid references public.stores (id);
alter table public.admin_profiles add column if not exists store_id uuid references public.stores (id);
alter table public.push_templates add column if not exists store_id uuid references public.stores (id);
alter table public.promo_banners add column if not exists store_id uuid references public.stores (id);
alter table public.promo_modal_banners add column if not exists store_id uuid references public.stores (id);
alter table public.faq_items add column if not exists store_id uuid references public.stores (id);
alter table public.pizza_sizes add column if not exists store_id uuid references public.stores (id);
alter table public.pizza_flavor_prices add column if not exists store_id uuid references public.stores (id);
alter table public.pizza_addons add column if not exists store_id uuid references public.stores (id);

create index if not exists categories_store_id_idx on public.categories (store_id);
create index if not exists products_store_id_idx on public.products (store_id);
create index if not exists add_ons_store_id_idx on public.add_ons (store_id);
create index if not exists customers_store_id_idx on public.customers (store_id);
create index if not exists orders_store_id_idx on public.orders (store_id);
create index if not exists carts_store_id_idx on public.carts (store_id);
create index if not exists coupons_store_id_idx on public.coupons (store_id);
create index if not exists promotions_store_id_idx on public.promotions (store_id);
create index if not exists satellite_locations_store_id_idx on public.satellite_locations (store_id);
create index if not exists admin_profiles_store_id_idx on public.admin_profiles (store_id);
create index if not exists push_templates_store_id_idx on public.push_templates (store_id);
create index if not exists promo_banners_store_id_idx on public.promo_banners (store_id);
create index if not exists promo_modal_banners_store_id_idx on public.promo_modal_banners (store_id);
create index if not exists faq_items_store_id_idx on public.faq_items (store_id);
create index if not exists pizza_sizes_store_id_idx on public.pizza_sizes (store_id);
create index if not exists pizza_flavor_prices_store_id_idx on public.pizza_flavor_prices (store_id);
create index if not exists pizza_addons_store_id_idx on public.pizza_addons (store_id);

-- Branding/config por tenant (Fase A do ADR-0001).
alter table public.stores add column if not exists domain text unique;
alter table public.stores add column if not exists theme jsonb not null default '{}'::jsonb;
alter table public.stores add column if not exists logo_url text;
alter table public.stores add column if not exists font_config jsonb not null default '{}'::jsonb;
alter table public.stores add column if not exists features jsonb not null default '{}'::jsonb;

comment on column public.stores.domain is 'Hostname que resolve para este tenant (subdomínio ou domínio próprio do cliente) — usado pelo middleware de resolução (Fase B).';
comment on column public.stores.theme is 'CSS variables de tema por tenant (cores), injetadas em runtime — ver Fase D do ADR-0001.';
comment on column public.stores.logo_url is 'URL do logo no Supabase Storage. Nulo usa o fallback genérico da UI, não a marca da Zelo.';
comment on column public.stores.font_config is 'Seleção de fontes suportadas por tenant (não é upload de fonte arbitrária).';
comment on column public.stores.features is 'Feature flags por tenant, formato { "<flag>": { "enabled": boolean, "config"?: {...} } } — ver tabela de flags no ADR-0001.';
