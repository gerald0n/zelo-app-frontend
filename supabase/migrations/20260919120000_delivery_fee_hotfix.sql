-- Hotfix: deixa de existir entrega grátis. A coluna mantém o nome legado,
-- mas passa a representar o limite da faixa reduzida de R$ 3,00.
-- Acima de 1 km, a taxa permanece em R$ 5,00.
update public.stores
set
  free_delivery_radius_meters = 1000,
  fixed_delivery_fee_cents = 500;

update public.satellite_locations
set
  free_delivery_radius_meters = 1000,
  fixed_delivery_fee_cents = 500;
