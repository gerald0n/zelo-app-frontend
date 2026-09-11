'use client';

import Link from 'next/link';
import { Bike, MapPin, ShoppingBag } from 'lucide-react';
import { formatCatalogPrice } from '@/modules/catalog/types';
import {
  statusLabel,
  STATUS_COLORS,
  isAwaitingPixPayment,
} from '@/modules/orders/types';
import type { AdminOrderListItem } from '@/modules/admin/types';
import { useNow } from '@/hooks/useNow';
import { cn } from '@/lib/cn';

type Props = {
  order: AdminOrderListItem;
};

export default function AdminOrderCard({ order }: Props) {
  const createdAt = new Date(order.createdAt).getTime();
  const now = useNow(createdAt + 60_000);
  const age = Math.max(1, Math.round((now - createdAt) / 60000));
  const awaitingPayment = isAwaitingPixPayment(order);

  return (
    <Link
      href={`/pedido/${order.id}`}
      className="block space-y-2.5 rounded-lg border border-border bg-card p-3.5 transition-colors duration-150 hover:border-foreground/15"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-base font-bold tabular-nums">{order.number}</p>
          <p className="mt-0.5 text-2xs tabular-nums text-muted-foreground">
            {age < 60
              ? `há ${age} min`
              : new Date(order.createdAt).toLocaleDateString('pt-BR')}
            {order.customerName ? ` · ${order.customerName}` : ''}
            {order.isGuest ? ' · Avulso' : ''}
          </p>
        </div>
        <p className="text-base font-bold tabular-nums">
          {formatCatalogPrice(order.totalCents)}
        </p>
      </div>
      <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
        {order.items
          .map((item) => `${item.quantity}× ${item.name}`)
          .join(' · ')}
      </p>
      {order.deliveryMethod === 'delivery' && order.deliveryAddress ? (
        <p className="flex items-start gap-1 text-2xs leading-snug text-muted-foreground">
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
              : STATUS_COLORS[order.status],
          )}
        >
          {awaitingPayment ? 'Aguardando Pix' : statusLabel(order.status)}
        </span>
        <div className="flex items-center gap-1 text-2xs text-muted-foreground">
          {order.deliveryMethod === 'delivery' ? (
            <Bike className="size-3.5" />
          ) : (
            <ShoppingBag className="size-3.5" />
          )}
          {order.deliveryMethod === 'delivery' ? 'Entrega' : 'Retirada'}
        </div>
      </div>
    </Link>
  );
}
