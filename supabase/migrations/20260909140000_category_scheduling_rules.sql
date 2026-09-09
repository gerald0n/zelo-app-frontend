-- Agendamento derivado por categoria.
--
-- Antes: a loja guardava uma lista fixa de horários (`stores.schedule_slot_times`)
-- e o admin editava dia a dia. Agora cada categoria carrega a regra de
-- agendamento dos seus produtos e o app deriva datas/horários a partir da
-- janela de funcionamento do dia + dessa regra. O admin não configura mais a
-- lista de horários manualmente.

alter table public.categories
  add column scheduling_allow_same_day boolean not null default true,
  add column scheduling_same_day_lead_minutes integer not null default 120,
  add column scheduling_weekday_earliest text,
  add column scheduling_weekend_earliest text,
  add column scheduling_slot_interval_minutes integer not null default 30;

alter table public.categories
  add constraint categories_scheduling_lead_nonneg
    check (scheduling_same_day_lead_minutes between 0 and 1440),
  add constraint categories_scheduling_interval_range
    check (scheduling_slot_interval_minutes between 5 and 240),
  add constraint categories_scheduling_weekday_hhmm
    check (
      scheduling_weekday_earliest is null
      or scheduling_weekday_earliest ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    ),
  add constraint categories_scheduling_weekend_hhmm
    check (
      scheduling_weekend_earliest is null
      or scheduling_weekend_earliest ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    );

-- Semente da regra de pudins: nunca no mesmo dia, piso 17h (semana) / 10h
-- (fim de semana), horários de hora em hora.
update public.categories
  set scheduling_allow_same_day = false,
      scheduling_weekday_earliest = '17:00',
      scheduling_weekend_earliest = '10:00',
      scheduling_slot_interval_minutes = 60
  where archived_at is null
    and (lower(name) like '%pudim%' or lower(name) like '%pudins%');

-- Remove a lista global de horários de agendamento (agora derivada por
-- categoria) e a função que a validava.
alter table public.stores drop column if exists schedule_slot_times;
drop function if exists public.is_hhmm_list(text[]);
