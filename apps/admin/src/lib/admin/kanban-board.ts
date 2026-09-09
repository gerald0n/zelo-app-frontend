import type { AdminOrderListItem } from '@/modules/admin/types';
import { statusLabel, type OrderStatus } from '@/modules/orders/types';
import { BOARD_COLUMNS } from '@/lib/admin/order-columns';

/**
 * Quadro de pedidos como duas raias paralelas (Retirada / Delivery). Cada raia
 * é um fluxo independente com o seu próprio pipeline de colunas. A primeira
 * coluna de cada raia é sempre "Agendados" — pedidos agendados que ainda não
 * começaram — separada por uma linha vertical do restante do pipeline.
 */
export type LaneKey = 'pickup' | 'delivery';

/** Coluna sintética "Agendados" mais as colunas reais de status. */
export type BoardColumn = 'agendados' | OrderStatus;

export const LANES: Array<{ key: LaneKey; label: string }> = [
  { key: 'pickup', label: 'Retirada' },
  { key: 'delivery', label: 'Delivery' },
];

export const LANE_LABEL: Record<LaneKey, string> = {
  pickup: 'Retirada',
  delivery: 'Delivery',
};

/**
 * Status sem coluna própria no quadro — o card é exibido na coluna indicada.
 * "Pronto para entrega" foi retirado do fluxo visual do Delivery: o pedido
 * salta de "Em produção" direto para "Saiu para entrega".
 */
const COLUMN_ALIAS: Partial<Record<OrderStatus, OrderStatus>> = {
  ready_for_delivery: 'out_for_delivery',
};

const LANE_COLUMNS: Record<LaneKey, OrderStatus[]> = {
  pickup: BOARD_COLUMNS.pickup,
  delivery: BOARD_COLUMNS.delivery.filter(
    (status) => !(status in COLUMN_ALIAS),
  ),
};

/** Um pedido agendado que ainda não começou vive na coluna "Agendados". */
export function isScheduledPending(order: AdminOrderListItem): boolean {
  return order.timing === 'scheduled' && order.status === 'received';
}

export function laneOf(order: AdminOrderListItem): LaneKey {
  return order.deliveryMethod === 'delivery' ? 'delivery' : 'pickup';
}

/** Coluna que hospeda um status, aplicando os apelidos de coluna. */
export function boardColumnForStatus(status: OrderStatus): OrderStatus {
  return COLUMN_ALIAS[status] ?? status;
}

/** Coluna onde o card aparece: "Agendados" enquanto agendado e ainda em `received`. */
export function columnOf(
  order: AdminOrderListItem,
  displayStatus: OrderStatus,
): BoardColumn {
  if (order.timing === 'scheduled' && displayStatus === 'received') {
    return 'agendados';
  }
  return boardColumnForStatus(displayStatus);
}

export function columnLabel(column: BoardColumn): string {
  return column === 'agendados' ? 'Agendados' : statusLabel(column);
}

/** Rótulo curto para os chips do quadro no celular (cabem mais na tela). */
const SHORT_COLUMN_LABEL: Partial<Record<OrderStatus, string>> = {
  received: 'Recebido',
  confirmed: 'Confirmado',
  in_production: 'Produção',
  ready_for_pickup: 'Pronto',
  ready_for_delivery: 'Pronto',
  out_for_delivery: 'Saiu',
  delivered: 'Entregue',
};

export function columnShortLabel(column: BoardColumn): string {
  if (column === 'agendados') return 'Agendados';
  return SHORT_COLUMN_LABEL[column] ?? statusLabel(column);
}

/** Colunas visíveis de uma raia, já aplicando o filtro "ocultar entregues". */
export function columnsForLane(
  lane: LaneKey,
  hideDelivered: boolean,
): BoardColumn[] {
  const columns = LANE_COLUMNS[lane];
  const visible = hideDelivered
    ? columns.filter((status) => status !== 'delivered')
    : columns;
  return ['agendados', ...visible];
}
