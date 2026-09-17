import type { DeliveryQuoteSource } from '@/modules/delivery';

export type CheckoutOptions = {
  fulfillmentLocation: 'pereiro';
  /** `false` quando o local satélite (São Miguel) está desativado no admin. */
  satelliteAvailable: boolean;
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
    /** `false` = a categoria do carrinho só funciona agendada (ex.: pudins). */
    allowSameDay: boolean;
    /** Carrinho mistura categorias com regras de agendamento diferentes. */
    mixedCart: boolean;
    /** Um grupo por regra distinta no carrinho — só preenchido quando `mixedCart`. */
    mixedGroups: MixedCartGroup[];
    /** Rótulo curto de funcionamento (ex.: "Hoje 19:00", "Amanhã 08:00"). */
    hoursLabel: string;
    availableDates: string[];
    timesByDate: Record<string, { delivery: string[]; pickup: string[] }>;
  };
};

/** Categorias que compartilham a mesma regra de agendamento + sua primeira data livre. */
export type MixedCartGroup = {
  categoryNames: string[];
  firstAvailableDate: string | null;
};

/**
 * Shape do local satélite (São Miguel/RN) — dias fixos + retirada "qualquer
 * horário numa janela" (sem grade) + lista curta de horários de entrega.
 * Deliberadamente diferente de `CheckoutOptions.scheduling` (motor separado,
 * ver `scheduling/satellite-slots.ts`).
 */
export type SatelliteDeliverySlotOption = {
  weekday: number;
  startsAt: string;
  endsAt: string | null;
  label: string | null;
  sortOrder: number;
};

export type SatelliteCheckoutOptions = {
  fulfillmentLocation: 'sao_miguel';
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
    allowSameDay: boolean;
    mixedCart: boolean;
    mixedGroups: MixedCartGroup[];
    availableDates: string[];
    pickupWindowByDate: Record<string, { opensAt: string; closesAt: string }>;
    deliverySlotsByDate: Record<string, SatelliteDeliverySlotOption[]>;
  };
};

export type AnyCheckoutOptions = CheckoutOptions | SatelliteCheckoutOptions;

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

function joinCategoryNames(names: string[]): string {
  if (names.length === 0) return 'alguns itens';
  const lower = names.map((name) => name.toLowerCase());
  if (lower.length === 1) return lower[0];
  return `${lower.slice(0, -1).join(', ')} e ${lower[lower.length - 1]}`;
}

/**
 * Explica, categoria a categoria, por que um carrinho misto não pode seguir
 * (ex.: "Há disponibilidade de cookies para hoje; porém, esfirras só tem
 * agendamento a partir de amanhã.").
 */
export function describeMixedCartAvailability(
  groups: Array<{ categoryNames: string[]; firstAvailableDate: string | null }>,
): string {
  const parts = groups.map((group) => {
    const label = joinCategoryNames(group.categoryNames);
    if (!group.firstAvailableDate) {
      return `não há horários disponíveis para ${label} no momento`;
    }
    const relative = relativeDayLabel(group.firstAvailableDate);
    if (relative === 'Hoje') return `há disponibilidade de ${label} para hoje`;
    if (relative === 'Amanhã') {
      return `${label} só tem agendamento a partir de amanhã`;
    }
    const date = new Date(`${group.firstAvailableDate}T12:00:00`);
    const formatted = date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
    });
    return `${label} só tem agendamento a partir de ${formatted}`;
  });
  const sentence = parts.join('; porém, ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
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
