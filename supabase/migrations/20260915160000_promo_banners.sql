-- Banners promocionais do carrossel da home do client — hoje o carrossel é
-- 3 slides fixos no código, sem dado do banco. Editável em Configurações.
create table public.promo_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  storage_path text not null,
  link_href text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index promo_banners_sort_idx
  on public.promo_banners (sort_order);

alter table public.promo_banners enable row level security;

grant select on public.promo_banners to anon, authenticated;
grant select, insert, update, delete on public.promo_banners to authenticated;

-- Cliente só vê banner ativo e dentro da janela de vigência; admin vê tudo
-- (pra poder gerenciar rascunhos/agendados na tela de Configurações).
create policy promo_banners_public_read
  on public.promo_banners for select
  to anon, authenticated
  using (
    private.is_admin()
    or (
      is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
    )
  );

create policy promo_banners_admin_manage
  on public.promo_banners for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: bucket banner-images (mesmo padrão de product-images)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'banner-images',
  'banner-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy banner_images_storage_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'banner-images');

create policy banner_images_storage_admin_insert
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'banner-images' and private.is_admin());

create policy banner_images_storage_admin_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'banner-images' and private.is_admin())
  with check (bucket_id = 'banner-images' and private.is_admin());

create policy banner_images_storage_admin_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'banner-images' and private.is_admin());
