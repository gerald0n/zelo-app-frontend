import type { DeliveryQuoteSource } from '@/modules/delivery';

export type CheckoutOptions = {
  store: {
    id: string;
    name: string;
    addressLine: string;
    city: string;
    state: string;
    latitude: number;
    longitude: number;
    freeDeliveryRadiusMeters: number;
    fixedDeliveryFeeCents: number;
  };
  neighborhoods: Array<{ id: string; name: string }>;
  scheduling: {
    storeOpen: boolean;
    availableDates: string[];
    timesByDate: Record<string, { delivery: string[]; pickup: string[] }>;
  };
};

export type ValidationResult = {
  inServiceArea: boolean;
  routeDistanceMeters: number;
  deliveryFeeCents: number;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  source: DeliveryQuoteSource;
  locationPrecision: 'high' | 'low';
  message?: string;
};

export function todayIso(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, hora local
}

/** "800 m" / "1 km" / "1,5 km". */
export function formatRadius(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  const km = meters / 1000;
  return `${(Number.isInteger(km) ? km.toString() : km.toFixed(1)).replace('.', ',')} km`;
}

export function relativeDayLabel(iso: string): string | null {
  const today = new Date(`${todayIso()}T12:00:00`);
  const target = new Date(`${iso}T12:00:00`);
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000,
  );
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  return null;
}

export function scheduleDateParts(iso: string): {
  weekday: string;
  day: string;
  month: string;
} {
  const date = new Date(`${iso}T12:00:00`);
  return {
    weekday: date
      .toLocaleDateString('pt-BR', { weekday: 'short' })
      .replace('.', ''),
    day: date.toLocaleDateString('pt-BR', { day: '2-digit' }),
    month: date
      .toLocaleDateString('pt-BR', { month: 'short' })
      .replace('.', ''),
  };
}

export function formatScheduleSummary(iso: string, time: string): string {
  const date = new Date(`${iso}T12:00:00`);
  const relative = relativeDayLabel(iso);
  const label = date.toLocaleDateString('pt-BR', {
    // Com rótulo relativo ("Amanhã") o dia da semana vira redundância.
    weekday: relative ? undefined : 'long',
    day: '2-digit',
    month: 'long',
  });
  const prefix = relative ? `${relative}, ` : '';
  return `${prefix}${label} às ${time}`;
}

/** Agrupa horários em manhã / tarde / noite para leitura mais fácil. */
export function groupTimesByPeriod(
  times: string[],
): Array<{ id: string; label: string; times: string[] }> {
  const buckets: Record<string, string[]> = {
    manha: [],
    tarde: [],
    noite: [],
  };
  for (const time of times) {
    const hour = Number(time.slice(0, 2));
    if (hour < 12) buckets.manha.push(time);
    else if (hour < 18) buckets.tarde.push(time);
    else buckets.noite.push(time);
  }
  return [
    { id: 'manha', label: 'Manhã', times: buckets.manha },
    { id: 'tarde', label: 'Tarde', times: buckets.tarde },
    { id: 'noite', label: 'Noite', times: buckets.noite },
  ].filter((group) => group.times.length > 0);
}
