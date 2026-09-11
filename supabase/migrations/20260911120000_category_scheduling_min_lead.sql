-- Antecedência mínima por horário de agendamento.
--
-- `scheduling_same_day_lead_minutes` só controla quando a agenda de "hoje"
-- passa a aparecer antes do expediente abrir. Ele não impede que o cliente
-- agende um horário que já está prestes a começar (ex.: pedir às 19h29 para
-- 19h30, sem tempo hábil de preparo/entrega). `scheduling_min_lead_minutes`
-- cobre esse caso: nenhum horário de hoje pode estar a menos desse tanto de
-- minutos de "agora", nem antes nem durante o expediente.

alter table public.categories
  add column scheduling_min_lead_minutes integer not null default 30;

alter table public.categories
  add constraint categories_scheduling_min_lead_nonneg
    check (scheduling_min_lead_minutes between 0 and 1440);
