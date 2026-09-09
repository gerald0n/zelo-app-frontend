import type { CatalogBlackout, CatalogStore } from '@/modules/catalog/types';
import { isCatalogStoreOpenNow } from '@/modules/catalog/store-hours';
import {
  DEFAULT_CATEGORY_SCHEDULING_RULE,
  schedulingRuleSignature,
  type CategorySchedulingRule,
} from '@/modules/scheduling/category-rules';
import {
  storeLocalToInstant,
  storeWallClock,
  weekdayOfDateIso,
} from '@/modules/scheduling/tz';

function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToHhmm(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function hourForWeekday(hours: CatalogStore['businessHours'], weekday: number) {
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

/**
 * Horários de agendamento disponíveis para um dia, já aplicando a regra da
 * categoria do pedido (piso de horário, mesmo-dia, intervalo) + a janela de
 * funcionamento do dia + períodos bloqueados.
 *
 * O `closesAt` do dia é o **horário limite** e entra na lista (inclusivo).
 */
export function listAvailableScheduleTimes(
  store: CatalogStore,
  dateIso: string,
  deliveryMethod: 'delivery' | 'pickup' = 'delivery',
  rule: CategorySchedulingRule = DEFAULT_CATEGORY_SCHEDULING_RULE,
  now: Date = new Date(),
): string[] {
  const weekday = weekdayOfDateIso(dateIso);
  const hour = hourForWeekday(store.businessHours, weekday);
  if (
    !hour ||
    hour.isClosed ||
    !hour.opensAt ||
    !hour.closesAt ||
    (deliveryMethod === 'delivery'
      ? !hour.deliveryEnabled
      : !hour.pickupEnabled)
  ) {
    return [];
  }

  const opensMin = parseTimeToMinutes(hour.opensAt);
  const closesMin = parseTimeToMinutes(hour.closesAt);
  const interval = rule.slotIntervalMinutes;
  if (closesMin <= opensMin || interval <= 0) return [];

  const isWeekend = weekday === 0 || weekday === 6;
  const floor = isWeekend ? rule.weekendEarliest : rule.weekdayEarliest;
  const startFloor = Math.max(
    opensMin,
    floor ? parseTimeToMinutes(floor) : opensMin,
  );
  if (startFloor > closesMin) return [];

  const wc = storeWallClock(store.timezone, now);
  let firstMin: number;

  if (dateIso < wc.dateIso) {
    return [];
  }
  if (dateIso === wc.dateIso) {
    if (!rule.allowSameDay) return [];
    if (wc.minutesOfDay >= closesMin) return [];
    if (wc.minutesOfDay < opensMin) {
      // Antes do expediente: a agenda de hoje só abre quando falta pouco
      // (janela de antecedência da categoria) para o primeiro horário.
      if (wc.minutesOfDay < opensMin - rule.sameDayLeadMinutes) return [];
      firstMin = startFloor;
    } else {
      // Dentro do expediente: a partir do próximo bloco cheio depois de agora.
      const nextBlock = (Math.floor(wc.minutesOfDay / interval) + 1) * interval;
      firstMin = Math.max(startFloor, nextBlock);
    }
  } else {
    firstMin = startFloor;
  }

  // Alinha à grade do intervalo, ancorada em startFloor.
  if (firstMin > startFloor) {
    const steps = Math.ceil((firstMin - startFloor) / interval);
    firstMin = startFloor + steps * interval;
  }

  const times: string[] = [];
  for (let min = firstMin; min <= closesMin; min += interval) {
    const time = minutesToHhmm(min);
    if (
      !isInstantInBlackout(
        storeLocalToInstant(store.timezone, dateIso, time),
        store.blackoutPeriods,
      )
    ) {
      times.push(time);
    }
  }
  return times;
}

export function listAvailableScheduleDates(
  store: CatalogStore,
  options?: {
    count?: number;
    deliveryMethod?: 'delivery' | 'pickup';
    rule?: CategorySchedulingRule;
    now?: Date;
  },
): string[] {
  const count = options?.count ?? 14;
  const method = options?.deliveryMethod ?? 'delivery';
  const rule = options?.rule ?? DEFAULT_CATEGORY_SCHEDULING_RULE;
  const now = options?.now ?? new Date();
  const wc = storeWallClock(store.timezone, now);

  const dates: string[] = [];
  const cursor = new Date(`${wc.dateIso}T12:00:00Z`);
  let scanned = 0;
  const maxScan = Math.max(count * 14, 90);

  while (dates.length < count && scanned < maxScan) {
    scanned += 1;
    const dateIso = cursor.toISOString().slice(0, 10);
    if (
      listAvailableScheduleTimes(store, dateIso, method, rule, now).length > 0
    ) {
      dates.push(dateIso);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export function canPlaceImmediateOrder(
  store: CatalogStore,
  now: Date = new Date(),
): boolean {
  if (isInstantInBlackout(now, store.blackoutPeriods)) return false;
  if (!isCatalogStoreOpenNow(store, now)) return false;

  // Mesmo com "aberto" forçado no painel, "Agora" só vale dentro da janela de
  // hoje — antes do primeiro horário do dia (ex.: loja abre 19h), só agendado.
  const wc = storeWallClock(store.timezone, now);
  const hour = hourForWeekday(store.businessHours, wc.weekday);
  if (hour && !hour.isClosed && hour.opensAt && hour.closesAt) {
    return (
      wc.minutesOfDay >= parseTimeToMinutes(hour.opensAt) &&
      wc.minutesOfDay < parseTimeToMinutes(hour.closesAt)
    );
  }
  return true;
}

export type CartSchedulingResolution = {
  /** Regra efetiva do pedido (quando não está bloqueado). */
  rule: CategorySchedulingRule;
  /** `true` quando o carrinho mistura categorias com regras diferentes. */
  mixed: boolean;
};

/**
 * Resolve a regra de agendamento de um carrinho a partir das categorias dos
 * produtos. Carrinho com mais de um "grupo de agendamento" → `mixed`.
 */
export function resolveCartSchedulingRule(
  categories: Array<{ id: string; scheduling: CategorySchedulingRule }>,
  products: Array<{ id: string; categoryId: string }>,
  productIds: string[],
): CartSchedulingResolution {
  const ruleByCategory = new Map(
    categories.map((category) => [category.id, category.scheduling]),
  );
  const categoryByProduct = new Map(
    products.map((product) => [product.id, product.categoryId]),
  );

  const bySignature = new Map<string, CategorySchedulingRule>();
  for (const productId of productIds) {
    const categoryId = categoryByProduct.get(productId);
    const rule =
      (categoryId ? ruleByCategory.get(categoryId) : undefined) ??
      DEFAULT_CATEGORY_SCHEDULING_RULE;
    bySignature.set(schedulingRuleSignature(rule), rule);
  }

  const rules = [...bySignature.values()];
  if (rules.length === 0) {
    return { rule: DEFAULT_CATEGORY_SCHEDULING_RULE, mixed: false };
  }
  return { rule: rules[0], mixed: rules.length > 1 };
}

export function buildSchedulingSnapshot(
  store: CatalogStore,
  rule: CategorySchedulingRule = DEFAULT_CATEGORY_SCHEDULING_RULE,
  now: Date = new Date(),
) {
  const dates = listAvailableScheduleDates(store, { rule, now });
  return {
    storeOpen: canPlaceImmediateOrder(store, now),
    availableDates: dates,
    timesByDate: Object.fromEntries(
      dates.map((date) => [
        date,
        {
          delivery: listAvailableScheduleTimes(
            store,
            date,
            'delivery',
            rule,
            now,
          ),
          pickup: listAvailableScheduleTimes(store, date, 'pickup', rule, now),
        },
      ]),
    ),
  };
}
