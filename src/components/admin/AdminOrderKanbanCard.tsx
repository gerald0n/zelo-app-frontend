'use client';

import Link from 'next/link';
import { useDraggable } from '@dnd-kit/core';
import { Bike, ShoppingBag, ArrowRight, X, GripVertical } from 'lucide-react';
import { formatCatalogPrice } from '@/modules/catalog/types';
import {
  statusLabel,
  STATUS_COLORS,
  isAwaitingPixPayment,
  type OrderStatus,
} from '@/modules/orders/types';
import { nextAdminStatus, type AdminOrderListItem } from '@/modules/admin/types';
import { urgencyLevel } from '@/lib/admin/order-urgency';
import { useNow } from '@/hooks/useNow';
import { cn } from '@/lib/cn';

type Props = {
  order: AdminOrderListItem;
  /** Status exibido — pode já refletir um avanço otimista em andamento. */
  displayStatus: OrderStatus;
  onAdvance: (order: AdminOrderListItem, nextStatus: OrderStatus) => void;
  onCancel: (order: AdminOrderListItem) => void;
  busy: boolean;
  /** false na lista mobile — lá não há colunas pra soltar, só o botão avança. */
  draggable?: boolean;
};

const URGENCY_BORDER: Record<'normal' | 'warning' | 'critical', string> = {
  normal: 'border-border',
  warning: 'border-tone-warning',
  critical: 'border-destructive',
};

export default function AdminOrderKanbanCard({
  order,
  displayStatus,
  onAdvance,
  onCancel,
  busy,
  draggable = true,
}: Props) {
  const updatedAt = new Date(order.updatedAt).getTime();
  const now = useNow(updatedAt);
  const minutesSince = Math.max(0, Math.round((now - updatedAt) / 60_000));
  const urgency = urgencyLevel(minutesSince, displayStatus);
  const awaitingPayment = isAwaitingPixPayment(order);
  const next = nextAdminStatus(displayStatus, order.deliveryMethod);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: order.id,
      data: { order },
      disabled: !draggable || !next || busy,
    });

  return (
    <div
      ref={setNodeRef}
      style={
        transform
          ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
              zIndex: 10,
            }
          : undefined
      }
      className={cn(
        'space-y-2 rounded-lg border-2 bg-card p-3 transition-colors',
        URGENCY_BORDER[urgency],
        isDragging && 'opacity-60 shadow-lg',
        busy && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/admin/pedido/${order.id}`} className="min-w-0 flex-1">
          <p className="text-sm font-bold tabular-nums">{order.number}</p>
          <p className="mt-0.5 truncate text-2xs text-muted-foreground">
            {order.customerName ?? 'Cliente'}
          </p>
        </Link>
        {next && draggable ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            disabled={busy}
            className="shrink-0 touch-none rounded-md p-1 text-muted-foreground active:cursor-grabbing"
            aria-label="Arrastar para a próxima coluna"
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
      </div>

      <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
        {order.items.map((item) => `${item.quantity}× ${item.name}`).join(' · ')}
      </p>

      <div className="flex items-center justify-between">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-2xs font-semibold',
            awaitingPayment
              ? 'bg-tone-warning text-tone-warning-foreground'
              : STATUS_COLORS[displayStatus],
          )}
        >
          {awaitingPayment ? 'Aguardando Pix' : statusLabel(displayStatus)}
        </span>
        <span className="flex items-center gap-1 text-2xs font-semibold text-muted-foreground">
          {order.deliveryMethod === 'delivery' ? (
            <Bike className="size-3.5" />
          ) : (
            <ShoppingBag className="size-3.5" />
          )}
          {formatCatalogPrice(order.totalCents)}
        </span>
      </div>

      {order.timing === 'scheduled' && order.scheduledFor ? (
        <p className="rounded-md bg-tone-info px-2 py-1 text-2xs font-medium text-tone-info-foreground">
          Agendado para{' '}
          {new Date(order.scheduledFor).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      ) : null}

      <div className="flex gap-1.5 pt-0.5">
        {next ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAdvance(order, next)}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary py-1.5 text-2xs font-semibold text-white transition-transform active:scale-[0.97] disabled:opacity-50"
          >
            {statusLabel(next)}
            <ArrowRight className="size-3" />
          </button>
        ) : (
          <span className="flex-1 py-1.5 text-center text-2xs text-muted-foreground">
            Concluído
          </span>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => onCancel(order)}
          className="rounded-md border border-border p-1.5 text-destructive disabled:opacity-50"
          aria-label="Cancelar pedido"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
