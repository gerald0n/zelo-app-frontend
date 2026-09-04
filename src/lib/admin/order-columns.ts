import type { OrderStatus } from '@/modules/orders/types';

export type BoardKind = 'pickup' | 'delivery';

/**
 * Colunas de cada quadro, na ordem de exibição. As 3 primeiras são iguais nos
 * dois quadros (received/confirmed/in_production) — só a cauda muda conforme
 * o método de entrega.
 */
export const BOARD_COLUMNS: Record<BoardKind, OrderStatus[]> = {
  pickup: [
    'received',
    'confirmed',
    'in_production',
    'ready_for_pickup',
    'delivered',
  ],
  delivery: [
    'received',
    'confirmed',
    'in_production',
    'ready_for_delivery',
    'out_for_delivery',
    'delivered',
  ],
};
