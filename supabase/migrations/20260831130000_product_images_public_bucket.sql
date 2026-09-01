-- O bucket product-images foi criado como `public = false`, mas o app monta
-- URLs pelo endpoint `/storage/v1/object/public/...`, que só serve buckets
-- públicos — resultado: imagem quebrada no cardápio.
--
-- As imagens de produto são conteúdo público do cardápio (já existe policy
-- de leitura para anon). Tornar o bucket público habilita o caminho público
-- e o CDN. Vale retroativamente para imagens já enviadas.

update storage.buckets
set public = true
where id = 'product-images';
