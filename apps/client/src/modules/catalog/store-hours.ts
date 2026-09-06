import type { CatalogStore } from '@/modules/catalog/types';

function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

export function isCatalogStoreOpenNow(
  store: CatalogStore,
  now = new Date(),
): boolean {
  if (store.isOpenOverride === false) return false;
  if (store.isOpenOverride === true) return true;

  const weekday = now.getDay();
  const hour = store.businessHours.find((item) => item.weekday === weekday);
  if (!hour || hour.isClosed || !hour.opensAt || !hour.closesAt) return false;

  const totalMins = now.getHours() * 60 + now.getMinutes();
  return (
    totalMins >= parseTimeToMinutes(hour.opensAt) &&
    totalMins < parseTimeToMinutes(hour.closesAt)
  );
}

const SHORT_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Texto curto para o header — cabe numa linha ao lado de "· Entrega e retirada"
 * (ex.: "Hoje até 18:00", "Amanhã 08:00", "Sáb 08:00").
 */
export function getCatalogStoreHoursLabel(
  store: CatalogStore,
  now = new Date(),
): string {
  const today = store.businessHours.find((item) => item.weekday === now.getDay());
  if (isCatalogStoreOpenNow(store, now)) {
    if (today?.closesAt) return `Hoje até ${today.closesAt.slice(0, 5)}`;
    return 'Aberto agora';
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const day = (now.getDay() + offset) % 7;
    const hour = store.businessHours.find((item) => item.weekday === day);
    if (hour && !hour.isClosed && hour.opensAt) {
      const at = hour.opensAt.slice(0, 5);
      return offset === 1 ? `Amanhã ${at}` : `${SHORT_WEEKDAYS[day]} ${at}`;
    }
  }

  return 'Ver horários';
}
