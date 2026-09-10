'use client';

import { Bike, ShoppingBag, ArrowRight, MapPin, X } from 'lucide-react';
import { formatCatalogPrice } from '@/modules/catalog/types';
import {
  statusLabel,
  STATUS_COLORS,
  isAwaitingPixPayment,
  type OrderStatus,
} from '@/modules/orders/types';
import {
  nextAdminStatus,
  type AdminOrderListItem,
} from '@/modules/admin/types';
import { urgencyLevel } from '@/lib/admin/order-urgency';
import { useNow } from '@/hooks/useNow';
import { cn } from '@/lib/cn';

type Props = {
  order: AdminOrderListItem;
  /** Status exibido — pode refletir um avanço otimista em andamento. */
  displayStatus: OrderStatus;
  onAdvance: (order: AdminOrderListItem, nextStatus: OrderStatus) => void;
  onCancel: (order: AdminOrderListItem) => void;
  busy: boolean;
  /** `true` só no clone renderizado no overlay de arraste — muda a moldura. */
  dragging?: boolean;
  /** Lista do celular: uma coluna só, então o card pode respirar mais. */
  roomy?: boolean;
  className?: string;
};

const URGENCY_BORDER: Record<'normal' | 'warning' | 'critical', string> = {
  normal: 'border-border',
  warning: 'border-tone-warning',
  critical: 'border-destructive',
};

/**
 * Conteúdo visual de um card de pedido. Compartilhado pelo quadro desktop
 * (`AdminKanbanBoard`) e pela lista compacta (mobile). Um clique no card
 * abre o modal de detalhes; o arraste é iniciado por um `onPointerDown` no
 * card inteiro. Os botões de ação (avançar / cancelar) contam como clique de
 * verdade — os handlers ignoram o gesto quando o alvo é um `<button>`.
 */
export default function AdminOrderCardBody({
  order,
  displayStatus,
  onAdvance,
  onCancel,
  busy,
  dragging = false,
  roomy = false,
  className,
}: Props) {
  const updatedAt = new Date(order.updatedAt).getTime();
  const now = useNow(updatedAt);
  const minutesSince = Math.max(0, Math.round((now - updatedAt) / 60_000));
  const urgency = urgencyLevel(minutesSince, displayStatus);
  const awaitingPayment = isAwaitingPixPayment(order);
  const next = nextAdminStatus(displayStatus, order.deliveryMethod);

  return (
    <div
      className={cn(
        'space-y-1.5 rounded-lg border bg-card p-2.5 transition-shadow',
        roomy && 'p-3',
        URGENCY_BORDER[urgency],
        dragging && 'shadow-lg',
        busy && 'opacity-60',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'font-bold tabular-nums',
              roomy ? 'text-base' : 'text-sm',
            )}
          >
            {order.number}
          </p>
          <p
            className={cn(
              'mt-0.5 truncate text-muted-foreground',
              roomy ? 'text-xs' : 'text-2xs',
            )}
          >
            {order.customerName ?? 'Cliente'}
            {order.isGuest ? ' · Avulso' : ''}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-2xs font-semibold text-muted-foreground">
          {order.deliveryMethod === 'delivery' ? (
            <Bike className="size-3.5" />
          ) : (
            <ShoppingBag className="size-3.5" />
          )}
          {formatCatalogPrice(order.totalCents)}
        </span>
      </div>

      <p
        className={cn(
          'line-clamp-2 leading-snug text-muted-foreground',
          roomy ? 'text-sm' : 'text-xs',
        )}
      >
        {order.items
          .map((item) => `${item.quantity}× ${item.name}`)
          .join(' · ')}
      </p>

      {order.deliveryMethod === 'delivery' && order.deliveryAddress ? (
        <p
          className={cn(
            'flex items-start gap-1 leading-snug text-muted-foreground',
            roomy ? 'text-xs' : 'text-2xs',
          )}
        >
          <MapPin className="mt-px size-3 shrink-0" />
          <span className="line-clamp-2">{order.deliveryAddress.short}</span>
        </p>
      ) : null}

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
        {minutesSince >= 15 ? (
          <span className="text-2xs font-medium text-muted-foreground tabular-nums">
            há {minutesSince} min
          </span>
        ) : null}
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
            onClick={(event) => {
              event.stopPropagation();
              onAdvance(order, next);
            }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-md bg-primary font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:opacity-50',
              roomy ? 'py-2 text-xs' : 'py-1.5 text-2xs',
            )}
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
          onClick={(event) => {
            event.stopPropagation();
            onCancel(order);
          }}
          className="rounded-md border border-border p-1.5 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          aria-label="Cancelar pedido"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
