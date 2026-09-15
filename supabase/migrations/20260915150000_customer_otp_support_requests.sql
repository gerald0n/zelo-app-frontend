-- Suporte manual de acesso quando o cliente não recebe o código OTP (sem
-- rede móvel estável, etc). Uma tabela só cobre pedido → notificação →
-- aprovação → consumo, sem duplicar estado entre "solicitação" e "aprovação".
-- Mesmo padrão de customer_otp_challenges: RLS habilitado sem policy, acesso
-- exclusivo via service_role (toda a lógica fica na aplicação Node).
create table public.customer_otp_support_requests (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  requested_at timestamptz not null default now(),
  approved_by uuid references public.admin_profiles (id),
  approved_at timestamptz,
  expires_at timestamptz,
  consumed_at timestamptz
);

create index customer_otp_support_requests_phone_idx
  on public.customer_otp_support_requests (phone_e164, requested_at desc);

alter table public.customer_otp_support_requests enable row level security;

grant select, insert, update on public.customer_otp_support_requests to service_role;
