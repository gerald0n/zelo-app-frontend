import type { AdminOrderListItem } from '@/modules/admin/types';

export type DashboardPeriod = 'today' | '7d' | '30d';

export const PERIOD_LABEL: Record<DashboardPeriod, string> = {
  today: 'Hoje',
  '7d': '7 dias',
  '30d': '30 dias',
};

export type SalesBucket = { label: string; cents: number; count: number };

export type DashboardData = {
  revenueCents: number;
  deltaPct: number | null;
  orderCount: number;
  deliveredCount: number;
  ticketCents: number;
  pickupCents: number;
  deliveryCents: number;
  buckets: SalesBucket[];
  topProducts: Array<{ name: string; quantity: number }>;
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Início do período atual e do período anterior de mesmo tamanho. */
function periodRange(period: DashboardPeriod, now: Date) {
  const today = startOfDay(now);
  if (period === 'today') {
    const prevStart = new Date(today);
    prevStart.setDate(prevStart.getDate() - 1);
    return { start: today, prevStart, prevEnd: today };
  }
  const days = period === '7d' ? 7 : 30;
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - days);
  return { start, prevStart, prevEnd: start };
}

function sumRevenue(orders: AdminOrderListItem[], from: Date, to: Date) {
  return orders
    .filter((order) => {
      if (order.status === 'cancelled') return false;
      const at = new Date(order.createdAt);
      return at >= from && at < to;
    })
    .reduce((sum, order) => sum + order.totalCents, 0);
}

function buildBuckets(
  orders: AdminOrderListItem[],
  period: DashboardPeriod,
  start: Date,
  now: Date,
): SalesBucket[] {
  if (period === 'today') {
    const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 08h–19h
    return hours.map((hour) => {
      const inHour = orders.filter((order) => {
        if (order.status === 'cancelled') return false;
        const at = new Date(order.createdAt);
        return at >= start && at.getHours() === hour;
      });
      return {
        label: `${String(hour).padStart(2, '0')}h`,
        cents: inHour.reduce((s, o) => s + o.totalCents, 0),
        count: inHour.length,
      };
    });
  }

  const days = period === '7d' ? 7 : 30;
  return Array.from({ length: days }, (_, i) => {
    const dayStart = new Date(start);
    dayStart.setDate(dayStart.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const inDay = orders.filter((order) => {
      if (order.status === 'cancelled') return false;
      const at = new Date(order.createdAt);
      return at >= dayStart && at < dayEnd && at <= now;
    });
    return {
      label: dayStart.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }),
      cents: inDay.reduce((s, o) => s + o.totalCents, 0),
      count: inDay.length,
    };
  });
}

export function buildDashboard(
  orders: AdminOrderListItem[],
  period: DashboardPeriod,
  now: Date = new Date(),
): DashboardData {
  const { start, prevStart, prevEnd } = periodRange(period, now);
  const end = new Date(now.getTime() + 1000);

  const inPeriod = orders.filter((order) => {
    const at = new Date(order.createdAt);
    return at >= start && at <= now && order.status !== 'cancelled';
  });

  const revenueCents = inPeriod.reduce((s, o) => s + o.totalCents, 0);
  const prevRevenue = sumRevenue(orders, prevStart, prevEnd);
  const deltaPct =
    prevRevenue > 0
      ? Math.round(((revenueCents - prevRevenue) / prevRevenue) * 1000) / 10
      : null;

  const deliveredCount = inPeriod.filter(
    (o) => o.status === 'delivered',
  ).length;
  const pickupCents = inPeriod
    .filter((o) => o.deliveryMethod !== 'delivery')
    .reduce((s, o) => s + o.totalCents, 0);

  const productMap = new Map<string, number>();
  for (const order of inPeriod) {
    for (const item of order.items) {
      productMap.set(
        item.name,
        (productMap.get(item.name) ?? 0) + item.quantity,
      );
    }
  }
  const topProducts = [...productMap.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  return {
    revenueCents,
    deltaPct,
    orderCount: inPeriod.length,
    deliveredCount,
    ticketCents: inPeriod.length
      ? Math.round(revenueCents / inPeriod.length)
      : 0,
    pickupCents,
    deliveryCents: revenueCents - pickupCents,
    buckets: buildBuckets(orders, period, start, end),
    topProducts,
  };
}
