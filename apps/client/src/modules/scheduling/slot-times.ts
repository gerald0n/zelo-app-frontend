/**
 * Horários candidatos de agendamento (HH:MM).
 *
 * A loja guarda a lista no banco (`stores.schedule_slot_times`, editável no
 * admin); o app filtra cada horário pela janela de funcionamento do dia e
 * pelos períodos bloqueados. Esta lista é só o fallback quando a loja ainda
 * não tem nada configurado.
 */
export const DEFAULT_SCHEDULE_SLOT_TIMES = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
] as const;

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function isHhmm(value: string): boolean {
  return HHMM.test(value);
}

/** Sanitiza a lista vinda do banco: só HH:MM válidos, únicos e ordenados. */
export function normalizeSlotTimes(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === 'string' && isHhmm(item))
    : [];
  const unique = Array.from(new Set(list)).sort();
  return unique.length > 0 ? unique : [...DEFAULT_SCHEDULE_SLOT_TIMES];
}
