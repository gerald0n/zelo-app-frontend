'use client';

import { useDroppable } from '@dnd-kit/core';
import { statusLabel, type OrderStatus } from '@/modules/orders/types';
import type { AdminOrderListItem } from '@/modules/admin/types';
import AdminOrderKanbanCard from '@/components/admin/AdminOrderKanbanCard';
import { cn } from '@/lib/cn';

type Props = {
  status: OrderStatus;
  orders: AdminOrderListItem[];
  displayStatusFor: (order: AdminOrderListItem) => OrderStatus;
  onAdvance: (order: AdminOrderListItem, nextStatus: OrderStatus) => void;
  onCancel: (order: AdminOrderListItem) => void;
  busyOrderId: string | null;
  className?: string;
};

export default function AdminKanbanColumn({
  status,
  orders,
  displayStatusFor,
  onAdvance,
  onCancel,
  busyOrderId,
  className,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-lg border border-border/60 bg-muted/40 p-2',
        isOver && 'border-primary bg-primary/5',
        className,
      )}
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {statusLabel(status)}
        </p>
        <span className="rounded-full bg-card px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground">
          {orders.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {orders.map((order) => (
          <AdminOrderKanbanCard
            key={order.id}
            order={order}
            displayStatus={displayStatusFor(order)}
            onAdvance={onAdvance}
            onCancel={onCancel}
            busy={busyOrderId === order.id}
          />
        ))}
        {orders.length === 0 ? (
          <p className="px-1 py-6 text-center text-2xs text-muted-foreground">
            Vazio
          </p>
        ) : null}
      </div>
    </div>
  );
}
