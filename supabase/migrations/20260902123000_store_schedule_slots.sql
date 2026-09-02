-- Horários de agendamento configuráveis pelo admin.
--
-- Antes: lista fixa no código (`DEFAULT_SCHEDULE_TIMES`). Agora a loja guarda
-- os horários candidatos (HH:MM) e o app continua filtrando cada um pela
-- janela de funcionamento do dia + períodos bloqueados.

create or replace function public.is_hhmm_list(v text[])
returns boolean
language sql
immutable
as $$
  select
    v is null
    or (
      coalesce(array_length(v, 1), 0) between 1 and 48
      and (
        select bool_and(item ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
        from unnest(v) as item
      )
    )
$$;

alter table public.stores
  add column if not exists schedule_slot_times text[] not null default array[
    '08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'
  ]::text[];

alter table public.stores
  drop constraint if exists stores_schedule_slot_times_valid;

alter table public.stores
  add constraint stores_schedule_slot_times_valid
  check (public.is_hhmm_list(schedule_slot_times));
