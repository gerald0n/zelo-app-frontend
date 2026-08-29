-- (Intencionalmente sem efeito.)
--
-- Esta migration antes definia a senha do admin como `admin123` via UPDATE em
-- auth.users. Isso é um risco: migrations rodam em produção, e um UPDATE cego
-- por e-mail poderia sobrescrever a senha real de um admin de produção que use
-- o mesmo endereço.
--
-- A credencial de desenvolvimento (admin@zeloconfeitaria.com.br / admin123)
-- agora vive só em supabase/seed.sql, que roda apenas em `supabase db reset`
-- (local) e nunca em `supabase db push` / `migration up` (produção).
--
-- Em produção o admin é criado manualmente (auth user + linha em
-- public.admin_profiles) com uma senha forte. Ver docs/20-tecnico/29.

select 1 where false;
