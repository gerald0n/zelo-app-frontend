/**
 * Visão geral do painel — tipos + planejamento da consulta (no fuso do
 * cliente) + agregação (roda no servidor, ver `dashboard-report.ts`).
 *
 * O cliente calcula as fronteiras de tempo no SEU fuso e manda como instantes
 * ISO; o servidor só compara instantes, sem lógica de timezone.
 */

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

/** Parâmetros que o cliente calcula e envia ao endpoint `kind=dashboard`. */
export type DashboardQuery = {
  /** Início do período atual (ISO). */
  from: string;
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

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Monta a `DashboardQuery` e os rótulos das barras para o período, no fuso
 * local do cliente. Chamado no cliente.
 */
export function planDashboardQuery(
  period: DashboardPeriod,
  now: Date = new Date(),
): { query: DashboardQuery; labels: string[] } {
  const today = startOfDay(now);

  if (period === 'today') {
    // Curva por hora, janela de operação 08h–19h (12 barras); os totais do
    // topo contam o dia inteiro a partir da meia-noite.
    const bucketFrom = new Date(today);
    bucketFrom.setHours(8, 0, 0, 0);
    const prevFrom = new Date(today);
    prevFrom.setDate(prevFrom.getDate() - 1);
    return {
      query: {
        from: today.toISOString(),
        prevFrom: prevFrom.toISOString(),
        prevTo: today.toISOString(),
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

  const days = period === '7d' ? 7 : 30;
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  const prevFrom = new Date(from);
  prevFrom.setDate(prevFrom.getDate() - days);
  return {
    query: {
      from: from.toISOString(),
      prevFrom: prevFrom.toISOString(),
      prevTo: from.toISOString(),
      bucketFrom: from.toISOString(),
      grain: 'day',
      count: days,
    },
    labels: Array.from({ length: days }, (_, i) => {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      });
    }),
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
  query: DashboardQuery,
): DashboardReport {
  const from = Date.parse(query.from);
  const prevFrom = Date.parse(query.prevFrom);
  const prevTo = Date.parse(query.prevTo);
  const bucketFrom = Date.parse(query.bucketFrom);
  const stepMs = query.grain === 'hour' ? 3_600_000 : 86_400_000;

  const at = (order: AggOrder) => Date.parse(order.createdAt);
  const alive = orders.filter((order) => order.status !== 'cancelled');
  const current = alive.filter((order) => at(order) >= from);

  const revenueCents = current.reduce((sum, o) => sum + o.totalCents, 0);
  const prevRevenue = alive
    .filter((o) => at(o) >= prevFrom && at(o) < prevTo)
    .reduce((sum, o) => sum + o.totalCents, 0);
  const deltaPct =
    prevRevenue > 0
      ? Math.round(((revenueCents - prevRevenue) / prevRevenue) * 1000) / 10
      : null;

  const pickupCents = current
    .filter((o) => o.deliveryMethod !== 'delivery')
    .reduce((sum, o) => sum + o.totalCents, 0);

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
    buckets,
    topProducts,
  };
}
