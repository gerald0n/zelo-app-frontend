/**
 * Relógio de parede no fuso da loja.
 *
 * O servidor (Vercel) roda em UTC; o cliente, no fuso do aparelho. Toda a
 * lógica de agenda ("hoje", "faltam 2h para abrir", "próximo bloco de 30min")
 * precisa raciocinar no fuso da loja (`stores.timezone`, ex.: America/Fortaleza)
 * — nunca em `Date#getHours()` cru.
 */

export type StoreWallClock = {
  /** Data civil YYYY-MM-DD no fuso da loja. */
  dateIso: string;
  /** Dia da semana no fuso da loja (0 = domingo … 6 = sábado). */
  weekday: number;
  /** Minutos desde a meia-noite local (0–1439). */
  minutesOfDay: number;
  hours: number;
  minutes: number;
};

function partsInZone(timezone: string, at: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(at)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    // Alguns motores devolvem "24" à meia-noite.
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export function storeWallClock(
  timezone: string,
  at: Date = new Date(),
): StoreWallClock {
  const p = partsInZone(timezone, at);
  const dateIso = `${String(p.year).padStart(4, '0')}-${String(
    p.month,
  ).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  // O dia da semana de uma data civil é inequívoco: interpreta como UTC.
  const weekday = new Date(`${dateIso}T00:00:00Z`).getUTCDay();
  return {
    dateIso,
    weekday,
    minutesOfDay: p.hour * 60 + p.minute,
    hours: p.hour,
    minutes: p.minute,
  };
}

/** Dia da semana (0–6) de uma data civil YYYY-MM-DD, sem depender de fuso. */
export function weekdayOfDateIso(dateIso: string): number {
  return new Date(`${dateIso}T00:00:00Z`).getUTCDay();
}

function zoneOffsetMs(timezone: string, at: Date): number {
  const p = partsInZone(timezone, at);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - at.getTime();
}

/**
 * Converte um horário de parede da loja (data YYYY-MM-DD + HH:MM) no instante
 * UTC correspondente. Usado para comparar com períodos bloqueados (que são
 * instantes absolutos).
 */
export function storeLocalToInstant(
  timezone: string,
  dateIso: string,
  timeHhmm: string,
): Date {
  const [y, m, d] = dateIso.split('-').map(Number);
  const [hh, mm] = timeHhmm.slice(0, 5).split(':').map(Number);
  const naiveUtc = Date.UTC(y, m - 1, d, hh, mm, 0);
  // Brasil não tem horário de verão desde 2019, mas dois passes deixam o
  // cálculo correto mesmo em fusos com DST.
  const firstGuess = new Date(
    naiveUtc - zoneOffsetMs(timezone, new Date(naiveUtc)),
  );
  return new Date(naiveUtc - zoneOffsetMs(timezone, firstGuess));
}
