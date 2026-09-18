-- ADR-0001, Fase D: o app para de usar o selo fixo da Zelo
-- (public/brand/zelo-selo.png) como fallback de logo pra qualquer tenant sem
-- `logo_url` — um tenant novo, sem logo próprio, não deve mais herdar a
-- marca da Zelo. Isso exige que a própria loja da Zelo tenha `logo_url`
-- explícito, senão ela perderia o selo visualmente com essa mudança.
update public.stores
set logo_url = '/brand/zelo-selo.png'
where id = 'a0000000-0000-4000-8000-000000000001'
  and logo_url is null;
