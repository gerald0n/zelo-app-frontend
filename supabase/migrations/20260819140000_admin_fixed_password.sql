-- Senha administrativa definida: admin@zeloconfeitaria.com.br / admin123

update auth.users
set
  encrypted_password = crypt('admin123', gen_salt('bf')),
  updated_at = now()
where email = 'admin@zeloconfeitaria.com.br';

update public.admin_profiles
set must_set_password = false
where id = 'f0000000-0000-4000-8000-000000000001';
