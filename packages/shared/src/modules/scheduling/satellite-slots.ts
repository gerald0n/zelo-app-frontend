import type {
  SatelliteDeliverySlot,
  SatelliteLocation,
  SatelliteWeekdayHour,
} from '@/modules/catalog/types';
import { storeWallClock, weekdayOfDateIso } from '@/modules/scheduling/tz';

/**
 * Agenda do local satélite (São Miguel/RN): dias fixos da semana, retirada
 * "qualquer horário" numa janela (sem grade) e uma lista curta e explícita
 * de horários de entrega por dia (não a grade por intervalo de
 * `scheduling/schedule.ts` — os dois motores são deliberadamente
 * independentes, ver plano).
 */

function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function hourForWeekday(
  hours: SatelliteWeekdayHour[],
  weekday: number,
): SatelliteWeekdayHour | undefined {
  return hours.find((item) => item.weekday === weekday);
}

function slotsForWeekday(
  slots: SatelliteDeliverySlot[],
  weekday: number,
): SatelliteDeliverySlot[] {
  return slots
    .filter((slot) => slot.weekday === weekday)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function listSatellitePickupWindow(
  location: SatelliteLocation,
  dateIso: string,
  now: Date = new Date(),
): { opensAt: string; closesAt: string } | null {
  const weekday = weekdayOfDateIso(dateIso);
  const hour = hourForWeekday(location.hours, weekday);
  if (!hour || hour.isClosed || !hour.pickupOpensAt || !hour.pickupClosesAt) {
    return null;
  }

  const wc = storeWallClock(location.timezone, now);
  if (dateIso < wc.dateIso) return null;
  if (
    dateIso === wc.dateIso &&
    wc.minutesOfDay >= parseTimeToMinutes(hour.pickupClosesAt)
  ) {
    // Janela de hoje já fechou.
    return null;
  }

  return { opensAt: hour.pickupOpensAt, closesAt: hour.pickupClosesAt };
}

export function listSatelliteDeliverySlots(
  location: SatelliteLocation,
  dateIso: string,
  now: Date = new Date(),
): SatelliteDeliverySlot[] {
  const weekday = weekdayOfDateIso(dateIso);
  const hour = hourForWeekday(location.hours, weekday);
  if (!hour || hour.isClosed || !hour.deliveryEnabled) return [];

  const wc = storeWallClock(location.timezone, now);
  if (dateIso < wc.dateIso) return [];

  const slots = slotsForWeekday(location.deliverySlots, weekday);
  if (dateIso > wc.dateIso) return slots;

  // Hoje: descarta slots a menos de `minLeadMinutes` de agora (ou já passados).
  const cutoff = wc.minutesOfDay + location.minLeadMinutes;
  return slots.filter((slot) => parseTimeToMinutes(slot.startsAt) >= cutoff);
}

export function listSatelliteActiveDates(
  location: SatelliteLocation,
  options?: { count?: number; now?: Date },
): string[] {
  const count = options?.count ?? 14;
  const now = options?.now ?? new Date();
  const wc = storeWallClock(location.timezone, now);

  const dates: string[] = [];
  const cursor = new Date(`${wc.dateIso}T12:00:00Z`);
  let scanned = 0;
  const maxScan = Math.max(count * 7, 60);

  while (dates.length < count && scanned < maxScan) {
    scanned += 1;
    const dateIso = cursor.toISOString().slice(0, 10);
    const hasPickup = listSatellitePickupWindow(location, dateIso, now) !== null;
    const hasDelivery =
      listSatelliteDeliverySlots(location, dateIso, now).length > 0;
    if (hasPickup || hasDelivery) dates.push(dateIso);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

/** "Agora" só existe pra retirada — entrega sempre exige um dos slots fixos. */
export function canPlaceImmediateSatelliteOrder(
  location: SatelliteLocation,
  now: Date = new Date(),
): boolean {
  if (!location.isActive) return false;
  const wc = storeWallClock(location.timezone, now);
  const window = listSatellitePickupWindow(location, wc.dateIso, now);
  if (!window) return false;
  return wc.minutesOfDay >= parseTimeToMinutes(window.opensAt);
}

export function isSatelliteSlotValid(
  location: SatelliteLocation,
  dateIso: string,
  time: string,
  deliveryMethod: 'delivery' | 'pickup',
  now: Date = new Date(),
): boolean {
  if (deliveryMethod === 'pickup') {
    const window = listSatellitePickupWindow(location, dateIso, now);
    if (!window) return false;
    const minutes = parseTimeToMinutes(time);
    return (
      minutes >= parseTimeToMinutes(window.opensAt) &&
      minutes <= parseTimeToMinutes(window.closesAt)
    );
  }

  return listSatelliteDeliverySlots(location, dateIso, now).some(
    (slot) => slot.startsAt.slice(0, 5) === time.slice(0, 5),
  );
}

export type SatelliteSchedulingSnapshot = {
  locationId: string;
  storeOpen: boolean;
  availableDates: string[];
  pickupWindowByDate: Record<string, { opensAt: string; closesAt: string }>;
  deliverySlotsByDate: Record<string, SatelliteDeliverySlot[]>;
};

export function buildSatelliteSchedulingSnapshot(
  location: SatelliteLocation,
  now: Date = new Date(),
): SatelliteSchedulingSnapshot {
  const dates = listSatelliteActiveDates(location, { now });
  return {
    locationId: location.id,
    storeOpen: canPlaceImmediateSatelliteOrder(location, now),
    availableDates: dates,
    pickupWindowByDate: Object.fromEntries(
      dates
        .map((date) => [date, listSatellitePickupWindow(location, date, now)])
        .filter((entry): entry is [string, { opensAt: string; closesAt: string }] =>
          entry[1] !== null,
        ),
    ),
    deliverySlotsByDate: Object.fromEntries(
      dates.map((date) => [
        date,
        listSatelliteDeliverySlots(location, date, now),
      ]),
    ),
  };
}
