'use client';

import Link from 'next/link';
import { Bike, ShoppingBag } from 'lucide-react';
import { formatCatalogPrice } from '@/modules/catalog/types';
import { statusLabel } from '@/modules/orders/types';
import type { AdminOrderListItem } from '@/modules/admin/types';
import { useNow } from '@/hooks/useNow';

type Props = {
  order: AdminOrderListItem;
};

export default function AdminOrderCard({ order }: Props) {
  const createdAt = new Date(order.createdAt).getTime();
  const now = useNow(createdAt + 60_000);
  const age = Math.max(1, Math.round((now - createdAt) / 60000));

  return (
    <Link
      href={`/admin/pedido/${order.id}`}
      className="block space-y-2.5 rounded-[11px] border border-border bg-card p-3.5"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-base font-bold">{order.number}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {age < 60
              ? `há ${age} min`
              : new Date(order.createdAt).toLocaleDateString('pt-BR')}
            {order.customerName ? ` · ${order.customerName}` : ''}
          </p>
        </div>
        <p className="text-[15px] font-bold">
          {formatCatalogPrice(order.totalCents)}
        </p>
      </div>
      <p className="line-clamp-2 text-xs leading-[17px] text-muted-foreground">
        {order.items
          .map((item) => `${item.quantity}× ${item.name}`)
          .join(' · ')}
      </p>
      <div className="flex items-center justify-between">
        <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
          {statusLabel(order.status)}
        </span>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
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
