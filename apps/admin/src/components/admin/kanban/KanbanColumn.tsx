'use client';

import type { PointerEvent } from 'react';
import type { AdminOrderListItem } from '@/modules/admin/types';
import { nextAdminStatus } from '@/modules/admin/types';
import type { OrderStatus } from '@/modules/orders/types';
import { type BoardColumn, columnLabel } from '@/lib/admin/kanban-board';
import AdminOrderCardBody from '@/components/admin/kanban/AdminOrderCardBody';
import { cn } from '@/lib/cn';

type Props = {
  column: BoardColumn;
  orders: AdminOrderListItem[];
  displayStatusFor: (order: AdminOrderListItem) => OrderStatus;
  onAdvance: (order: AdminOrderListItem, nextStatus: OrderStatus) => void;
  onCancel: (order: AdminOrderListItem) => void;
  busyOrderId: string | null;
  draggingOrderId: string | null;
  isDropTarget: boolean;
  isHot: boolean;
  onCardPointerDown: (
    event: PointerEvent<HTMLDivElement>,
    order: AdminOrderListItem,
    status: OrderStatus,
  ) => void;
  onCardActivate: (order: AdminOrderListItem) => void;
  columnRef: (el: HTMLElement | null) => void;
};

/**
 * Uma coluna do quadro. A coluna "Agendados" ganha uma cor própria
 * (`tone-info`) para se distinguir do restante do pipeline.
 */
export default function KanbanColumn({
  column,
  orders,
  displayStatusFor,
  onAdvance,
  onCancel,
  busyOrderId,
  draggingOrderId,
  isDropTarget,
  isHot,
  onCardPointerDown,
  onCardActivate,
  columnRef,
}: Props) {
  const isScheduled = column === 'agendados';
  return (
    <div
      ref={columnRef}
      className={cn(
        'flex w-[212px] shrink-0 flex-col rounded-lg border transition-colors',
        isScheduled ? 'bg-tone-info/10' : 'bg-card',
        isDropTarget ? 'border-primary/50' : 'border-border/60',
        isHot && 'ring-2 ring-primary',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between border-b px-2.5 py-2',
          isScheduled ? 'border-tone-info/30' : 'border-border/60',
        )}
      >
        <span
          className={cn(
            'text-2xs font-bold uppercase tracking-wide',
            isScheduled ? 'text-tone-info-foreground' : 'text-muted-foreground',
          )}
        >
          {columnLabel(column)}
        </span>
        <span
          className={cn(
            'rounded-full px-1.5 text-2xs font-semibold tabular-nums',
            isScheduled
              ? 'bg-tone-info/20 text-tone-info-foreground'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {orders.length}
        </span>
      </div>

      <div className={cn('flex-1 space-y-2 p-2', isHot && 'bg-primary/5')}>
        {orders.map((order) => {
          const status = displayStatusFor(order);
          const draggable =
            !isScheduled &&
            nextAdminStatus(status, order.deliveryMethod) !== null;
          return (
            <div
              key={order.id}
              role="button"
              tabIndex={0}
              onPointerDown={
                draggable
                  ? (event) => onCardPointerDown(event, order, status)
                  : undefined
              }
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('button')) return;
                onCardActivate(order);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onCardActivate(order);
                }
              }}
              className={cn(
                'cursor-pointer',
                draggable && 'cursor-grab touch-none active:cursor-grabbing',
                draggingOrderId === order.id && 'opacity-30',
              )}
            >
              <AdminOrderCardBody
                order={order}
                displayStatus={status}
                onAdvance={onAdvance}
                onCancel={onCancel}
                busy={busyOrderId === order.id}
              />
            </div>
          );
        })}
        {orders.length === 0 ? (
          <p className="py-6 text-center text-2xs text-muted-foreground">—</p>
        ) : null}
      </div>
    </div>
  );
}
