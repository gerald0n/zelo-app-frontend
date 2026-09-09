import type { CatalogStore } from '@/modules/catalog/types';
import { storeWallClock } from '@/modules/scheduling/tz';

function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

/** Pausa com prazo ainda valendo? (prazo no passado = já retomou sozinha) */
export function isCatalogStorePaused(
  store: Pick<CatalogStore, 'pausedUntil'>,
  now = new Date(),
): boolean {
  return store.pausedUntil != null && new Date(store.pausedUntil) > now;
}

export function isCatalogStoreOpenNow(
  store: CatalogStore,
  now = new Date(),
): boolean {
  if (isCatalogStorePaused(store, now)) return false;
  if (store.isOpenOverride === false) return false;
  if (store.isOpenOverride === true) return true;

  const wc = storeWallClock(store.timezone, now);
  const hour = store.businessHours.find((item) => item.weekday === wc.weekday);
  if (!hour || hour.isClosed || !hour.opensAt || !hour.closesAt) return false;

  return (
    wc.minutesOfDay >= parseTimeToMinutes(hour.opensAt) &&
    wc.minutesOfDay < parseTimeToMinutes(hour.closesAt)
  );
}

const SHORT_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Texto curto para o header — cabe numa linha ao lado de "· Entrega e retirada"
 * (ex.: "Hoje até 18:00", "Hoje 19:00", "Amanhã 08:00", "Sáb 08:00").
 */
export function getCatalogStoreHoursLabel(
  store: CatalogStore,
  now = new Date(),
): string {
  const wc = storeWallClock(store.timezone, now);
  const today = store.businessHours.find((item) => item.weekday === wc.weekday);
  if (isCatalogStoreOpenNow(store, now)) {
    if (today?.closesAt) return `Hoje até ${today.closesAt.slice(0, 5)}`;
    return 'Aberto agora';
  }

  // Fechada por controle do painel: pausa sem previsão (`isOpenOverride ===
  // false`) ou pausa com prazo ainda valendo. A agenda semanal não vale nesse
  // estado — não adianta prometer "Amanhã 19:00" se a loja não vai abrir
  // sozinha (ou volta antes disso). O selo ao lado já diz "Fechado".
  if (store.isOpenOverride === false || isCatalogStorePaused(store, now)) {
    return 'Ver horários';
  }

  // Fechada agora, mas o horário de hoje ainda vai começar (ex.: são 15h e a
  // loja abre às 19h). Sem isto o rótulo pularia para "Amanhã".
  if (today && !today.isClosed && today.opensAt) {
    if (parseTimeToMinutes(today.opensAt) > wc.minutesOfDay) {
      return `Hoje ${today.opensAt.slice(0, 5)}`;
    }
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const day = (wc.weekday + offset) % 7;
    const hour = store.businessHours.find((item) => item.weekday === day);
    if (hour && !hour.isClosed && hour.opensAt) {
      const at = hour.opensAt.slice(0, 5);
      return offset === 1 ? `Amanhã ${at}` : `${SHORT_WEEKDAYS[day]} ${at}`;
    }
  }

  return 'Ver horários';
}
