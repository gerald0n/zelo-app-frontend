import {
  Bike,
  CheckCircle2,
  Home,
  Package,
  Receipt,
  Wrench,
} from 'lucide-react';
import type { CustomerOrder, OrderStatus } from '@/modules/orders/types';

export type Step = {
  id: OrderStatus;
  label: string;
  icon: React.ElementType;
};

export const DELIVERY_STEPS: Step[] = [
  { id: 'received', label: 'Pedido recebido', icon: Receipt },
  { id: 'confirmed', label: 'Confirmado', icon: CheckCircle2 },
  { id: 'in_production', label: 'Em produção', icon: Wrench },
  { id: 'ready_for_delivery', label: 'Pronto para entrega', icon: Package },
  { id: 'out_for_delivery', label: 'Saiu para entrega', icon: Bike },
  { id: 'delivered', label: 'Entregue', icon: Home },
];

export const PICKUP_STEPS: Step[] = [
  { id: 'received', label: 'Pedido recebido', icon: Receipt },
  { id: 'confirmed', label: 'Confirmado', icon: CheckCircle2 },
  { id: 'in_production', label: 'Em produção', icon: Wrench },
  { id: 'ready_for_pickup', label: 'Pronto para retirada', icon: Package },
  { id: 'delivered', label: 'Retirado', icon: Home },
];

export function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function historyTimeForStep(
  status: OrderStatus,
  history: CustomerOrder['history'],
  createdAt: string,
): string {
  const entry = [...history].reverse().find((item) => item.newStatus === status);
  if (entry) return formatClock(entry.createdAt);
  if (status === 'received') return formatClock(createdAt);
  return '--:--';
}
