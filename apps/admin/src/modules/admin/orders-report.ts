/**
 * Relatório detalhado de pedidos — tipos + agregação pura (resumo,
 * distribuição por distância, distribuição por horário).
 *
 * A agregação roda inteiramente no cliente, a partir do array completo de
 * pedidos já filtrado que o endpoint devolve — mesmo padrão de
 * `dashboard.ts`/`planDashboardQuery`: horário é sensível a fuso, então
 * calcular no navegador evita divergência com o fuso do servidor. Isso
 * também permite que a exportação .xlsx reuse exatamente a mesma função de
 * agregação usada na tela, sem duplicar a lógica.
 */

import type { OrderStatus, PaymentMethod } from '@/modules/orders/types';

export type OrderReportDeliveryMethod = 'delivery' | 'pickup';

export const ORDER_REPORT_DELIVERY_METHODS: OrderReportDeliveryMethod[] = [
  'delivery',
  'pickup',
];

/** Mesma ordem do fluxo operacional — reaproveitada pelo filtro e pela validação da rota. */
export const ORDER_REPORT_STATUSES: OrderStatus[] = [
  'received',
  'confirmed',
  'in_production',
  'ready_for_delivery',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

export const ORDER_REPORT_PAYMENT_METHODS: PaymentMethod[] = [
  'pix',
  'pix_manual',
  'cash',
  'card',
];

export type OrderReportRow = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  deliveryMethod: OrderReportDeliveryMethod;
  paymentMethod: PaymentMethod;
  /** Valor dos itens do cardápio, sem adicionais. */
  subtotalCents: number;
  /** Adicionais (ex.: coberturas de pizza). */
  addOnsCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  timing: 'immediate' | 'scheduled';
  /** Só quando `timing === 'scheduled'`. */
  scheduledFor: string | null;
  /** Só para pedidos de entrega. */
  neighborhood: string | null;
  /** Só para pedidos de entrega — distância usada para calcular a taxa. */
  distanceMeters: number | null;
  /** Instante de criação (ISO) — usado pra data, hora e distribuição por horário. */
  createdAt: string;
};

export type OrdersReportFilters = {
  /** ISO, inclusivo. */
  from: string;
  /** ISO, exclusivo. */
  to: string;
  deliveryMethod?: OrderReportDeliveryMethod;
  status?: OrderStatus;
  paymentMethod?: PaymentMethod;
  minDistanceMeters?: number;
  maxDistanceMeters?: number;
  hasDiscount?: boolean;
};

export type OrdersReportSummary = {
  totalOrders: number;
  deliveryOrders: number;
  pickupOrders: number;
  /** % de pedidos que são delivery. */
  deliveryPct: number;
  revenueCents: number;
  deliveryRevenueCents: number;
  pickupRevenueCents: number;
  avgTicketCents: number;
  avgTicketDeliveryCents: number;
  avgTicketPickupCents: number;
  deliveryFeeTotalCents: number;
  avgDeliveryFeeCents: number;
  /** `null` quando não há entregas com distância registrada. */
  avgDistanceMeters: number | null;
  freeDeliveries: number;
  paidDeliveries: number;
};

export type DistanceBucket = {
  label: string;
  minMeters: number;
  maxMeters: number | null;
  count: number;
  /** % sobre as entregas com distância conhecida. */
  pct: number;
  avgTicketCents: number;
  avgDeliveryFeeCents: number;
  revenueCents: number;
};

export type HourBucket = {
  hour: number;
  label: string;
  orders: number;
  deliveries: number;
  pickups: number;
  revenueCents: number;
};

const DISTANCE_BUCKET_EDGES: Array<{
  label: string;
  min: number;
  max: number | null;
}> = [
  { label: 'Até 1 km', min: 0, max: 1000 },
  { label: '1–2 km', min: 1000, max: 2000 },
  { label: '2–3 km', min: 2000, max: 3000 },
  { label: '3–5 km', min: 3000, max: 5000 },
  { label: 'Acima de 5 km', min: 5000, max: null },
];

export type OrdersReportAggregate = {
  summary: OrdersReportSummary;
  distanceBuckets: DistanceBucket[];
  hourBuckets: HourBucket[];
};

/** Agrega resumo + distribuições a partir do conjunto completo já filtrado. */
export function aggregateOrdersReport(
  rows: OrderReportRow[],
): OrdersReportAggregate {
  const delivery = rows.filter((r) => r.deliveryMethod === 'delivery');
  const pickup = rows.filter((r) => r.deliveryMethod === 'pickup');

  const revenueCents = rows.reduce((sum, r) => sum + r.totalCents, 0);
  const deliveryRevenueCents = delivery.reduce((sum, r) => sum + r.totalCents, 0);
  const pickupRevenueCents = pickup.reduce((sum, r) => sum + r.totalCents, 0);
  const deliveryFeeTotalCents = delivery.reduce(
    (sum, r) => sum + r.deliveryFeeCents,
    0,
  );
  const distances = delivery
    .map((r) => r.distanceMeters)
    .filter((d): d is number => d !== null);
  const freeDeliveries = delivery.filter((r) => r.deliveryFeeCents === 0).length;

  const summary: OrdersReportSummary = {
    totalOrders: rows.length,
    deliveryOrders: delivery.length,
    pickupOrders: pickup.length,
    deliveryPct: rows.length
      ? Math.round((delivery.length / rows.length) * 1000) / 10
      : 0,
    revenueCents,
    deliveryRevenueCents,
    pickupRevenueCents,
    avgTicketCents: rows.length ? Math.round(revenueCents / rows.length) : 0,
    avgTicketDeliveryCents: delivery.length
      ? Math.round(deliveryRevenueCents / delivery.length)
      : 0,
    avgTicketPickupCents: pickup.length
      ? Math.round(pickupRevenueCents / pickup.length)
      : 0,
    deliveryFeeTotalCents,
    avgDeliveryFeeCents: delivery.length
      ? Math.round(deliveryFeeTotalCents / delivery.length)
      : 0,
    avgDistanceMeters: distances.length
      ? Math.round(distances.reduce((sum, d) => sum + d, 0) / distances.length)
      : null,
    freeDeliveries,
    paidDeliveries: delivery.length - freeDeliveries,
  };

  const distanceBuckets: DistanceBucket[] = DISTANCE_BUCKET_EDGES.map((edge) => {
    const inBucket = delivery.filter(
      (r) =>
        r.distanceMeters !== null &&
        r.distanceMeters >= edge.min &&
        (edge.max === null || r.distanceMeters < edge.max),
    );
    const bucketRevenue = inBucket.reduce((sum, r) => sum + r.totalCents, 0);
    const bucketFee = inBucket.reduce((sum, r) => sum + r.deliveryFeeCents, 0);
    return {
      label: edge.label,
      minMeters: edge.min,
      maxMeters: edge.max,
      count: inBucket.length,
      pct: distances.length
        ? Math.round((inBucket.length / distances.length) * 1000) / 10
        : 0,
      avgTicketCents: inBucket.length
        ? Math.round(bucketRevenue / inBucket.length)
        : 0,
      avgDeliveryFeeCents: inBucket.length
        ? Math.round(bucketFee / inBucket.length)
        : 0,
      revenueCents: bucketRevenue,
    };
  });

  const hourBuckets: HourBucket[] = Array.from({ length: 24 }, (_, hour) => {
    const inHour = rows.filter((r) => new Date(r.createdAt).getHours() === hour);
    return {
      hour,
      label: `${String(hour).padStart(2, '0')}h`,
      orders: inHour.length,
      deliveries: inHour.filter((r) => r.deliveryMethod === 'delivery').length,
      pickups: inHour.filter((r) => r.deliveryMethod === 'pickup').length,
      revenueCents: inHour.reduce((sum, r) => sum + r.totalCents, 0),
    };
  });

  return { summary, distanceBuckets, hourBuckets };
}
