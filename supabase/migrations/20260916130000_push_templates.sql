-- Modelos de push notification em massa — substitui o "escreve e dispara"
-- de PushBroadcastSection.tsx. O admin cria modelos com antecedência e
-- dispara depois: manual (botão + confirmação) ou agendado (dia/hora, via
-- Supabase Cron, ver supabase/cron/send-scheduled-pushes.sql). Reutilizável:
-- um modelo pode ser disparado várias vezes, por isso não existe um status
-- "sent" travado — volta pra draft depois de cada disparo.
create table public.push_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  url text,
  mode text not null check (mode in ('manual', 'scheduled')),
  scheduled_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'canceled')),
  last_sent_at timestamptz,
  send_count integer not null default 0,
  created_by uuid references public.admin_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_templates_scheduled_at_required
    check (mode <> 'scheduled' or status <> 'scheduled' or scheduled_at is not null)
);

create index push_templates_pending_idx
  on public.push_templates (scheduled_at)
  where status = 'scheduled';

alter table public.push_templates enable row level security;

grant select, insert, update, delete on public.push_templates to authenticated;

create policy push_templates_admin_manage
  on public.push_templates for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- Histórico de disparos por modelo (um modelo reutilizável pode ter vários).
-- Separado do audit_logs genérico pra guardar as contagens de entrega.
create table public.push_template_sends (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.push_templates(id) on delete cascade,
  triggered_by text not null check (triggered_by in ('manual', 'scheduled')),
  sent_by uuid references public.admin_profiles(id) on delete set null,
  sent_at timestamptz not null default now(),
  customers integer not null,
  devices integer not null,
  sent integer not null,
  failed integer not null,
  revoked integer not null
);

create index push_template_sends_template_idx
  on public.push_template_sends (template_id, sent_at desc);

alter table public.push_template_sends enable row level security;

grant select, insert on public.push_template_sends to authenticated;

create policy push_template_sends_admin_manage
  on public.push_template_sends for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());
