'use client';

import Link from 'next/link';
import { Bike, Loader2, RefreshCw, ShoppingBag } from 'lucide-react';
import { formatCatalogPrice } from '@/modules/catalog/types';
import {
  statusLabel,
  STATUS_COLORS,
  type CustomerOrderListItem,
} from '@/modules/orders/types';
import { cn } from '@/lib/cn';

type Props = {
  order: CustomerOrderListItem;
  href?: string;
  onReorder?: () => void;
  reordering?: boolean;
};

export default function OrderCard({
  order,
  href,
  onReorder,
  reordering = false,
}: Props) {
  const itemNames = order.items
    .map((i) => `${i.quantity}× ${i.name}`)
    .join(', ');
  const isDone = order.status === 'delivered' || order.status === 'cancelled';

  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold tabular-nums">{order.number}</span>
        <span
          className={cn(
            'rounded-md px-2 py-0.5 text-2xs font-semibold',
            STATUS_COLORS[order.status],
          )}
        >
          {statusLabel(order.status)}
        </span>
      </div>
      <p className="line-clamp-2 text-xs leading-4 text-muted-foreground">
        {itemNames}
      </p>
      <div className="mt-0.5 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {order.deliveryMethod === 'delivery' ? (
            <Bike className="size-[13px]" />
          ) : (
            <ShoppingBag className="size-[13px]" />
          )}
          {order.deliveryMethod === 'delivery' ? 'Entrega' : 'Retirada'}
        </div>
        <span className="text-sm font-bold tabular-nums">
          {formatCatalogPrice(order.totalCents)}
        </span>
      </div>
    </>
  );

  return (
    <div className="mx-3 mb-2 space-y-1.5 rounded-lg border border-border bg-card p-3">
      {href ? (
        <Link href={href} className="block space-y-1.5">
          {content}
        </Link>
      ) : (
        <div className="space-y-1.5">{content}</div>
      )}
      {isDone && onReorder ? (
        <button
          type="button"
          onClick={onReorder}
          disabled={reordering}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded-sm border border-border py-1.5 text-xs font-medium transition-[background-color,transform] duration-100 hover:bg-secondary active:scale-[0.99] disabled:opacity-70 disabled:active:scale-100"
        >
          {reordering ? (
            <Loader2 className="size-[13px] animate-spin" />
          ) : (
            <RefreshCw className="size-[13px]" />
          )}
          Pedir novamente
        </button>
      ) : null}
    </div>
  );
}
