-- Título do banner modal é só um rótulo interno pra identificar a campanha
-- na lista do admin — não precisa ser preenchido na criação.
alter table public.promo_modal_banners
  alter column title drop not null;
