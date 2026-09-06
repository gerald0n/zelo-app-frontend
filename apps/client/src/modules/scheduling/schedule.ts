import type {
  CatalogBlackout,
  CatalogStore,
} from '@/modules/catalog/types';
import { isCatalogStoreOpenNow } from '@/modules/catalog/store-hours';
import {
  DEFAULT_SCHEDULE_SLOT_TIMES,
  normalizeSlotTimes,
} from '@/modules/scheduling/slot-times';

function storeSlotTimes(store: CatalogStore): string[] {
  return normalizeSlotTimes(store.scheduleSlotTimes);
}

function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function timeWithinWindow(
  time: string,
  opensAt: string | null,
  closesAt: string | null,
): boolean {
  if (!opensAt || !closesAt) return false;
  const t = parseTimeToMinutes(time);
  return t >= parseTimeToMinutes(opensAt) && t < parseTimeToMinutes(closesAt);
}

/** Regra das 17h: até 17:00 → D+1; após → D+2. */
export function calcFirstScheduleDate(now = new Date()): Date {
  const isPastCutoff =
    now.getHours() > 17 || (now.getHours() === 17 && now.getMinutes() > 0);
  const daysToAdd = isPastCutoff ? 2 : 1;
  const first = new Date(now);
  first.setDate(first.getDate() + daysToAdd);
  first.setHours(0, 0, 0, 0);
  return first;
}

function hourForWeekday(
  hours: CatalogStore['businessHours'],
  weekday: number,
) {
  return hours.find((item) => item.weekday === weekday);
}

export function isInstantInBlackout(
  instant: Date,
  blackouts: CatalogBlackout[],
): boolean {
  const t = instant.getTime();
  return blackouts.some((period) => {
    const start = new Date(period.startsAt).getTime();
    const end = new Date(period.endsAt).getTime();
    return t >= start && t < end;
  });
}

function scheduleSlotInstant(dateIso: string, time: string): Date {
  return new Date(`${dateIso}T${time}:00`);
}

export function listAvailableScheduleDates(
  store: CatalogStore,
  options?: {
    from?: Date;
    count?: number;
    deliveryMethod?: 'delivery' | 'pickup';
  },
): string[] {
  const from = options?.from ?? calcFirstScheduleDate();
  const count = options?.count ?? 14;
  const method = options?.deliveryMethod ?? 'delivery';
  const dates: string[] = [];
  const cursor = new Date(from);
  let scanned = 0;
  const maxScan = Math.max(count * 14, 90);

  while (dates.length < count && scanned < maxScan) {
    scanned += 1;
    const dateIso = cursor.toISOString().slice(0, 10);
    const hour = hourForWeekday(store.businessHours, cursor.getDay());
    const open =
      hour &&
      !hour.isClosed &&
      (method === 'delivery' ? hour.deliveryEnabled : hour.pickupEnabled);
    if (
      open &&
      listAvailableScheduleTimes(store, dateIso, method).length > 0
    ) {
      dates.push(dateIso);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function listAvailableScheduleTimes(
  store: CatalogStore,
  dateIso: string,
  deliveryMethod: 'delivery' | 'pickup' = 'delivery',
): string[] {
  const date = new Date(`${dateIso}T12:00:00`);
  const hour = hourForWeekday(store.businessHours, date.getDay());
  if (
    !hour ||
    hour.isClosed ||
    (deliveryMethod === 'delivery'
      ? !hour.deliveryEnabled
      : !hour.pickupEnabled)
  ) {
    return [];
  }

  return storeSlotTimes(store).filter((time) => {
    if (!timeWithinWindow(time, hour.opensAt, hour.closesAt)) return false;
    return !isInstantInBlackout(
      scheduleSlotInstant(dateIso, time),
      store.blackoutPeriods,
    );
  });
}

export function canPlaceImmediateOrder(store: CatalogStore, now = new Date()) {
  if (isInstantInBlackout(now, store.blackoutPeriods)) return false;
  return isCatalogStoreOpenNow(store, now);
}

export function getSchedulingSnapshot(store: CatalogStore) {
  const firstDate = calcFirstScheduleDate();
  const dates = listAvailableScheduleDates(store, { from: firstDate });
  const first = dates[0];
  return {
    storeOpen: canPlaceImmediateOrder(store),
    firstScheduleDate: firstDate.toISOString().slice(0, 10),
    availableDates: dates,
    timesByDate: Object.fromEntries(
      dates.map((date) => [
        date,
        {
          delivery: listAvailableScheduleTimes(store, date, 'delivery'),
          pickup: listAvailableScheduleTimes(store, date, 'pickup'),
        },
      ]),
    ),
    defaultTimes: first
      ? listAvailableScheduleTimes(store, first, 'delivery')
      : [...DEFAULT_SCHEDULE_SLOT_TIMES],
  };
}
