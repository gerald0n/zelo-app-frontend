-- Título e subtítulo do carrossel deixam de ser configuráveis no admin: a
-- imagem do banner já deve trazer toda a informação. Colunas ficam
-- opcionais (mantidas pra não perder dado histórico, mas não são mais
-- exigidas ao criar/editar banners).
alter table public.promo_banners
  alter column title drop not null;
