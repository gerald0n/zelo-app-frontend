-- Raio máximo de entrega configurável pela loja.
--
-- Antes: constante `MAX_DELIVERY_RADIUS_METERS` no código (3 km). A área de
-- entrega passou a ser por raio (linha reta da loja até o cliente) em vez de
-- lista de bairros; este valor é o limite — além dele, só retirada.
-- O raio grátis (`free_delivery_radius_meters`) tem de caber dentro dele; a
-- relação é validada na camada de aplicação (mensagem amigável no admin).

alter table public.stores
  add column if not exists max_delivery_radius_meters integer not null default 3000;

alter table public.stores
  drop constraint if exists stores_max_delivery_radius_nonneg;

alter table public.stores
  add constraint stores_max_delivery_radius_nonneg
  check (max_delivery_radius_meters >= 0);
