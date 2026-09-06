import type { OrderStatus } from '@/modules/orders/types';

export type UrgencyLevel = 'normal' | 'warning' | 'critical';

const WARNING_MINUTES = 15;
const CRITICAL_MINUTES = 30;

/**
 * Régua de urgência por tempo parado no status atual. Estados terminais
 * nunca ficam urgentes — o pedido já saiu da fila de trabalho.
 */
export function urgencyLevel(
  minutesSinceUpdate: number,
  status: OrderStatus,
): UrgencyLevel {
  if (status === 'delivered' || status === 'cancelled') return 'normal';
  if (minutesSinceUpdate >= CRITICAL_MINUTES) return 'critical';
  if (minutesSinceUpdate >= WARNING_MINUTES) return 'warning';
  return 'normal';
}
