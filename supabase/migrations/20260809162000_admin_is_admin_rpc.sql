-- Fase I: helper público is_admin + seed do administrador local.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_admin();
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;
