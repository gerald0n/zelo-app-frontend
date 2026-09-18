/**
 * Visão geral do painel — tipos + planejamento da consulta (no fuso do
 * cliente) + agregação (roda no servidor, ver `dashboard-report.ts`).
 *
 * O cliente calcula as fronteiras de tempo no SEU fuso e manda como instantes
 * ISO; o servidor só compara instantes, sem lógica de timezone.
 */

export type DashboardPeriod = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export const PERIOD_LABEL: Record<DashboardPeriod, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  '7d': '7 dias',
  '30d': '30 dias',
  custom: 'Personalizado',
};

/** Datas locais (`yyyy-mm-dd`) escolhidas pelo usuário, ambas inclusivas. */
export type CustomRange = { from: string; to: string };

export type SalesBucket = { label: string; cents: number; count: number };

export type DashboardData = {
  revenueCents: number;
  deltaPct: number | null;
  orderCount: number;
  deliveredCount: number;
  ticketCents: number;
  pickupCents: number;
  deliveryCents: number;
  pickupCount: number;
  deliveryCount: number;
  /** Distância média das entregas do período (metros); `null` sem entregas. */
  avgDistanceMeters: number | null;
  buckets: SalesBucket[];
  topProducts: Array<{ name: string; quantity: number }>;
};

/** Parâmetros que o cliente calcula e envia ao endpoint `kind=dashboard`. */
export type DashboardQuery = {
  /** Início do período atual (ISO), inclusivo. */
  from: string;
  /** Fim do período atual (ISO), exclusivo. */
  to: string;
  /** Início do período anterior, de mesmo tamanho. */
  prevFrom: string;
  /** Fim do período anterior, exclusivo (= `from`). */
  prevTo: string;
  /** Início da 1ª barra da curva de vendas. */
  bucketFrom: string;
  grain: 'hour' | 'day';
  /** Nº de barras. */
  count: number;
};

/** Resposta do endpoint — sem `label` nas barras (o cliente já os tem). */
export type DashboardReport = Omit<DashboardData, 'buckets'> & {
  buckets: Array<{ cents: number; count: number }>;
};

export type ResolvedRange = { from: string; to: string };

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Resolve o período (preset ou personalizado) num range de instantes
 * `[from, to)`, no fuso local do cliente. Usado pela visão geral e também
 * pelos relatórios de operação/financeiro.
 */
export function resolvePeriodRange(
  period: DashboardPeriod,
  custom: CustomRange | null,
  now: Date = new Date(),
): ResolvedRange {
  const today = startOfDay(now);

  if (period === 'today') {
    return { from: today.toISOString(), to: addDays(today, 1).toISOString() };
  }
  if (period === 'yesterday') {
    return {
      from: addDays(today, -1).toISOString(),
      to: today.toISOString(),
    };
  }
  if (period === '7d' || period === '30d') {
    const days = period === '7d' ? 7 : 30;
    return {
      from: addDays(today, -(days - 1)).toISOString(),
      to: addDays(today, 1).toISOString(),
    };
  }

  // custom
  if (custom) {
    const from = startOfDay(new Date(`${custom.from}T00:00:00`));
    const to = addDays(startOfDay(new Date(`${custom.to}T00:00:00`)), 1);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from) {
      return { from: from.toISOString(), to: to.toISOString() };
    }
  }

  // Fronteiras inválidas ou ausentes — cai pra "hoje".
  return { from: today.toISOString(), to: addDays(today, 1).toISOString() };
}

/**
 * Monta a `DashboardQuery` e os rótulos das barras para o período, no fuso
 * local do cliente. Chamado no cliente.
 */
export function planDashboardQuery(
  period: DashboardPeriod,
  custom: CustomRange | null = null,
  now: Date = new Date(),
): { query: DashboardQuery; labels: string[] } {
  const range = resolvePeriodRange(period, custom, now);
  const from = new Date(range.from);
  const to = new Date(range.to);
  const spanDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);

  if (spanDays <= 1) {
    // Curva por hora, janela de operação 08h–19h (12 barras); os totais do
    // topo contam o dia inteiro.
    const bucketFrom = new Date(from);
    bucketFrom.setHours(8, 0, 0, 0);
    const prevFrom = addDays(from, -1);
    return {
      query: {
        from: range.from,
        to: range.to,
        prevFrom: prevFrom.toISOString(),
        prevTo: range.from,
        bucketFrom: bucketFrom.toISOString(),
        grain: 'hour',
        count: 12,
      },
      labels: Array.from(
        { length: 12 },
        (_, i) => `${String(i + 8).padStart(2, '0')}h`,
      ),
    };
  }

  const days = spanDays;
  const prevFrom = addDays(from, -days);
  return {
    query: {
      from: range.from,
      to: range.to,
      prevFrom: prevFrom.toISOString(),
      prevTo: range.from,
      bucketFrom: range.from,
      grain: 'day',
      count: days,
    },
    labels: Array.from({ length: days }, (_, i) =>
      addDays(from, i).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }),
    ),
  };
}

type AggOrder = {
  createdAt: string;
  totalCents: number;
  status: string;
  deliveryMethod: string;
};

/**
 * Agrega os indicadores a partir das linhas cruas (roda no servidor). Só
 * compara instantes — `query` já traz as fronteiras no fuso certo.
 */
export function aggregateDashboard(
  orders: AggOrder[],
  items: Array<{ name: string; quantity: number }>,
  deliveryDistancesMeters: number[],
  query: DashboardQuery,
): DashboardReport {
  const from = Date.parse(query.from);
  const to = Date.parse(query.to);
  const prevFrom = Date.parse(query.prevFrom);
  const prevTo = Date.parse(query.prevTo);
  const bucketFrom = Date.parse(query.bucketFrom);
  const stepMs = query.grain === 'hour' ? 3_600_000 : 86_400_000;

  const at = (order: AggOrder) => Date.parse(order.createdAt);
  const alive = orders.filter((order) => order.status !== 'cancelled');
  const current = alive.filter((order) => at(order) >= from && at(order) < to);

  const revenueCents = current.reduce((sum, o) => sum + o.totalCents, 0);
  const prevRevenue = alive
    .filter((o) => at(o) >= prevFrom && at(o) < prevTo)
    .reduce((sum, o) => sum + o.totalCents, 0);
  const deltaPct =
    prevRevenue > 0
      ? Math.round(((revenueCents - prevRevenue) / prevRevenue) * 1000) / 10
      : null;

  const pickupOrders = current.filter((o) => o.deliveryMethod !== 'delivery');
  const deliveryOrders = current.filter((o) => o.deliveryMethod === 'delivery');
  const pickupCents = pickupOrders.reduce((sum, o) => sum + o.totalCents, 0);

  const avgDistanceMeters = deliveryDistancesMeters.length
    ? Math.round(
        deliveryDistancesMeters.reduce((sum, m) => sum + m, 0) /
          deliveryDistancesMeters.length,
      )
    : null;

  const buckets = Array.from({ length: query.count }, (_, i) => {
    const lo = bucketFrom + i * stepMs;
    const hi = lo + stepMs;
    const inBucket = current.filter((o) => at(o) >= lo && at(o) < hi);
    return {
      cents: inBucket.reduce((sum, o) => sum + o.totalCents, 0),
      count: inBucket.length,
    };
  });

  const byProduct = new Map<string, number>();
  for (const item of items) {
    byProduct.set(item.name, (byProduct.get(item.name) ?? 0) + item.quantity);
  }
  const topProducts = [...byProduct.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  return {
    revenueCents,
    deltaPct,
    orderCount: current.length,
    deliveredCount: current.filter((o) => o.status === 'delivered').length,
    ticketCents: current.length ? Math.round(revenueCents / current.length) : 0,
    pickupCents,
    deliveryCents: revenueCents - pickupCents,
    pickupCount: pickupOrders.length,
    deliveryCount: deliveryOrders.length,
    avgDistanceMeters,
    buckets,
    topProducts,
  };
}
