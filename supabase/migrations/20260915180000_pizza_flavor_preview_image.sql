-- Foto de preview de sabor de pizza (sem a borda da massa)
--
-- O construtor de pizza (20260915170000) mostra o recheio de cada sabor
-- dentro do furo de uma foto de massa real, sobreposta via CSS no client. A
-- foto normal do produto (`product_images`) não serve pra isso: pode ter
-- fundo/enquadramento que conflita com a borda. Por isso um campo à parte,
-- direto em `products` (1 imagem, sem galeria/reorder/"principal" — reusa o
-- mesmo bucket `product-images`, só muda a coluna).

alter table public.products
  add column if not exists preview_image_storage_path text,
  add column if not exists preview_image_alt_text text;
