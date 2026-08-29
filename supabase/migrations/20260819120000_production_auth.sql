-- Autenticação de produção: primeiro acesso do admin + desafios OTP do cliente.

alter table public.admin_profiles
  add column if not exists must_set_password boolean not null default false;

comment on column public.admin_profiles.must_set_password is
  'Quando true, o administrador precisa definir a senha no primeiro acesso.';

create table if not exists public.customer_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  name text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempt_count integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint customer_otp_challenges_name_not_empty check (length(trim(name)) > 0),
  constraint customer_otp_challenges_phone_e164_not_empty check (length(trim(phone_e164)) > 8)
);

create index if not exists customer_otp_challenges_phone_created_idx
  on public.customer_otp_challenges (phone_e164, created_at desc);

alter table public.customer_otp_challenges enable row level security;

grant select, insert, update, delete on public.customer_otp_challenges to service_role;
