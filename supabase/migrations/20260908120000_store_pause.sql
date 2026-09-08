-- Pausa da loja com prazo e motivo.
--
-- Antes só existia `is_open_override` (null = segue horário, false = fechada,
-- true = aberta). Agora o admin pode pausar "até tal hora": `paused_until`
-- guarda o instante em que a loja volta sozinha. `pause_reason` é o texto
-- opcional mostrado pro time (não pro cliente).
--
-- A regra "loja aberta agora" (aplicação, em packages/shared) passa a checar:
--   paused_until > now()  -> fechada
--   is_open_override        -> como antes
--   senão                   -> horário de funcionamento
--
-- Pausa "sem previsão" continua sendo `is_open_override = false` com
-- `paused_until` nulo. Retomar limpa os dois.

alter table public.stores
  add column if not exists paused_until timestamptz,
  add column if not exists pause_reason text;
