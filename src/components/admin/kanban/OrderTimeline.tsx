import { statusLabel, type OrderStatus } from '@/modules/orders/types';
import type { AdminOrderDetail } from '@/modules/admin/types';
import { cn } from '@/lib/cn';

const STEP_LABEL: Partial<Record<OrderStatus, string>> = {
  received: 'Recebido',
  confirmed: 'Confirmado',
  in_production: 'Produção',
  ready_for_pickup: 'Pronto',
  ready_for_delivery: 'Pronto',
  out_for_delivery: 'Saiu',
  delivered: 'Entregue',
};

function stepsFor(method: AdminOrderDetail['deliveryMethod']): OrderStatus[] {
  return method === 'delivery'
    ? [
        'received',
        'confirmed',
        'in_production',
        'ready_for_delivery',
        'out_for_delivery',
        'delivered',
      ]
    : [
        'received',
        'confirmed',
        'in_production',
        'ready_for_pickup',
        'delivered',
      ];
}

export function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Stepper "Recebido → … → Entregue" com o horário de cada etapa do histórico. */
export default function OrderTimeline({ order }: { order: AdminOrderDetail }) {
  const steps = stepsFor(order.deliveryMethod);
  const currentIndex = steps.indexOf(order.status);

  const timeOf = (status: OrderStatus) => {
    const entry = order.history.find((h) => h.newStatus === status);
    if (entry) return clock(entry.createdAt);
    return status === 'received' ? clock(order.createdAt) : null;
  };

  return (
    <div className="flex items-start justify-between">
      {steps.map((status, index) => {
        const done = currentIndex >= 0 && index <= currentIndex;
        const time = timeOf(status);
        return (
          <div
            key={status}
            className="relative flex flex-1 flex-col items-center gap-1 text-center"
          >
            {index > 0 ? (
              <span
                className={cn(
                  'absolute right-1/2 top-3 h-0.5 w-full',
                  index <= currentIndex ? 'bg-primary' : 'bg-border',
                )}
              />
            ) : null}
            <span
              className={cn(
                'relative z-10 flex size-6 items-center justify-center rounded-full border text-2xs font-bold',
                done
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground',
              )}
            >
              {done && index < currentIndex ? '✓' : index + 1}
            </span>
            <span
              className={cn(
                'text-2xs font-semibold',
                done ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {STEP_LABEL[status] ?? statusLabel(status)}
            </span>
            {time ? (
              <span className="text-2xs tabular-nums text-muted-foreground">
                {time}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
