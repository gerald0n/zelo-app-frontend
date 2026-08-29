import type { Database } from '@/types/database';

export type OrderStatus = Database['public']['Enums']['order_status'];
export type DeliveryMethod = Database['public']['Enums']['delivery_method'];
export type PaymentMethod = Database['public']['Enums']['payment_method'];

export type CustomerOrderItem = {
  id: string;
  productId: string | null;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  note: string | null;
  addOns: Array<{
    id: string | null;
    name: string;
    quantity: number;
    unitPriceCents: number;
  }>;
};

export type CustomerOrderHistoryEntry = {
  id: string;
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  actorType: string;
  reason: string | null;
  createdAt: string;
};

export type CustomerOrder = {
  id: string;
  orderNumber: number;
  number: string;
  status: OrderStatus;
  timing: 'immediate' | 'scheduled';
  scheduledFor: string | null;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  needsChange: boolean | null;
  changeForAmountCents: number | null;
  customerNote: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  address: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    complement: string | null;
    referencePoint: string | null;
    formatted: string;
    routeDistanceMeters: number;
  } | null;
  items: CustomerOrderItem[];
  history: CustomerOrderHistoryEntry[];
  canCancel: boolean;
};

export type CustomerOrderListItem = Pick<
  CustomerOrder,
  | 'id'
  | 'orderNumber'
  | 'number'
  | 'status'
  | 'deliveryMethod'
  | 'paymentMethod'
  | 'subtotalCents'
  | 'deliveryFeeCents'
  | 'totalCents'
  | 'createdAt'
  | 'scheduledFor'
  | 'canCancel'
> & {
  items: Array<{
    name: string;
    quantity: number;
    lineTotalCents: number;
    addOns: string[];
  }>;
};

export const CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = [
  'received',
  'confirmed',
  'in_production',
];

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'received',
  'confirmed',
  'in_production',
  'ready_for_delivery',
  'ready_for_pickup',
  'out_for_delivery',
];

export function statusLabel(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    received: 'Pedido recebido',
    confirmed: 'Pedido confirmado',
    in_production: 'Em produção',
    ready_for_delivery: 'Pronto para entrega',
    ready_for_pickup: 'Pronto para retirada',
    out_for_delivery: 'Saiu para entrega',
    delivered: 'Entregue',
    cancelled: 'Cancelado',
  };
  return map[status];
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  received: 'bg-muted text-muted-foreground',
  confirmed: 'bg-caramel/30 text-caramel-foreground',
  in_production: 'bg-primary/10 text-primary',
  ready_for_delivery: 'bg-pistachio/50 text-pistachio-foreground',
  ready_for_pickup: 'bg-pistachio/50 text-pistachio-foreground',
  out_for_delivery: 'bg-pistachio/50 text-pistachio-foreground',
  delivered: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
};

export function canCustomerCancel(status: OrderStatus): boolean {
  return CUSTOMER_CANCELLABLE_STATUSES.includes(status);
}

export const STATUS_COPY: Partial<Record<OrderStatus, string>> = {
  received: 'Recebemos o seu pedido e vamos analisá-lo em instantes.',
  confirmed: 'Pedido confirmado! Em breve começamos o preparo.',
  in_production: 'Seu pedido está sendo preparado com carinho.',
  ready_for_delivery: 'Tudo pronto! Aguardando a saída para entrega.',
  ready_for_pickup: 'Seu pedido está pronto para retirada na loja.',
  out_for_delivery: 'Seu pedido saiu da loja e está a caminho.',
  delivered: 'Pedido concluído. Bom apetite!',
  cancelled: 'Este pedido foi cancelado.',
};
