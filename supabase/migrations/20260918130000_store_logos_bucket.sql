-- White label (ADR-0001, Fase E) — bucket pro upload de logo por tenant
-- via apps/gestor, mesmo padrão de product-images/banner-images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-logos',
  'store-logos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy store_logos_storage_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'store-logos');

create policy store_logos_storage_admin_insert
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'store-logos' and private.is_admin());

create policy store_logos_storage_admin_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'store-logos' and private.is_admin())
  with check (bucket_id = 'store-logos' and private.is_admin());

create policy store_logos_storage_admin_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'store-logos' and private.is_admin());
