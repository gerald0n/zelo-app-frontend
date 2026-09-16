-- FAQ do popover de ajuda do client — hoje é um array fixo no código
-- (apps/client/src/lib/faq-content.ts). Editável em Configurações.
create table public.faq_items (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index faq_items_sort_idx
  on public.faq_items (sort_order);

alter table public.faq_items enable row level security;

grant select on public.faq_items to anon, authenticated;
grant select, insert, update, delete on public.faq_items to authenticated;

create policy faq_items_public_read
  on public.faq_items for select
  to anon, authenticated
  using (private.is_admin() or is_active);

create policy faq_items_admin_manage
  on public.faq_items for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- Banner modal de campanha (popup 1x por sessão) — hoje é uma arte fixa
-- (PromoBannerModal.tsx, imagens em public/promo/). Diferente do carrossel
-- da home (promo_banners): tem 2 variantes de imagem (vertical/horizontal)
-- em vez de 1, e é um popup, não uma lista rotativa visível. Reaproveita o
-- bucket `banner-images` já existente (mesmas policies de storage já
-- cobrem qualquer path dentro do bucket).
create table public.promo_modal_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  link_href text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  storage_path_vertical text not null default '',
  storage_path_horizontal text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index promo_modal_banners_sort_idx
  on public.promo_modal_banners (sort_order);

alter table public.promo_modal_banners enable row level security;

grant select on public.promo_modal_banners to anon, authenticated;
grant select, insert, update, delete on public.promo_modal_banners to authenticated;

-- Mesma regra de promo_banners: cliente só vê ativo + dentro da vigência;
-- admin vê tudo (rascunhos/agendados) na tela de Configurações.
create policy promo_modal_banners_public_read
  on public.promo_modal_banners for select
  to anon, authenticated
  using (
    private.is_admin()
    or (
      is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
    )
  );

create policy promo_modal_banners_admin_manage
  on public.promo_modal_banners for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());
