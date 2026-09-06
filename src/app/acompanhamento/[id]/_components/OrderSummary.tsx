'use client';

import Link from 'next/link';
import {
  ChevronRight,
  Loader2,
  MapPin,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type { CustomerOrder } from '@/modules/orders/types';
import { cn } from '@/lib/utils';

type Props = {
  order: CustomerOrder;
  reordering: boolean;
  onReorder: () => void;
};

export function OrderSummary({ order, reordering, onReorder }: Props) {
  return (
    <div className="flex flex-col gap-3.5 lg:sticky lg:top-4 lg:col-span-1">
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-serif text-lg font-semibold text-foreground">
          Itens do pedido
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5">
              <span className="inline-flex min-w-8 items-center justify-center rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                {item.quantity}x
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-card-foreground">
                  {item.name}
                  {item.addOns.length > 0
                    ? ` (+ ${item.addOns.map((a) => a.name).join(', ')})`
                    : ''}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {formatCatalogPrice(item.lineTotalCents)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium tabular-nums text-foreground">
              {formatCatalogPrice(order.subtotalCents)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Entrega</span>
            <span
              className={cn(
                'font-medium tabular-nums',
                order.deliveryFeeCents === 0
                  ? 'text-success'
                  : 'text-foreground',
              )}
            >
              {order.deliveryFeeCents === 0
                ? 'Grátis'
                : formatCatalogPrice(order.deliveryFeeCents)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="font-serif text-lg font-semibold tabular-nums text-primary">
              {formatCatalogPrice(order.totalCents)}
            </span>
          </div>
        </div>
      </section>

      {order.deliveryMethod === 'delivery' && order.address ? (
        <Link
          href="/loja"
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 transition-[background-color,transform] duration-100 hover:bg-accent active:scale-[0.99]"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MapPin className="size-[18px]" />
          </span>
          <p className="min-w-0 flex-1 text-sm leading-5 text-card-foreground">
            {order.address.formatted}
          </p>
          <ChevronRight
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="sr-only">Ver informações da loja</span>
        </Link>
      ) : null}

      <div className="mt-1 flex flex-col gap-2.5">
        {(order.status === 'delivered' || order.status === 'cancelled') && (
          <button
            type="button"
            onClick={onReorder}
            disabled={reordering}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-semibold text-foreground transition-[background-color,transform] duration-100 hover:bg-accent active:scale-[0.99] disabled:opacity-70 disabled:active:scale-100"
          >
            {reordering ? (
              <Loader2 className="size-[18px] animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-[18px]" aria-hidden="true" />
            )}
            Pedir novamente
          </button>
        )}
        {order.canCancel ? (
          <Link
            href={`/cancelar-pedido?orderId=${order.id}&orderNumber=${encodeURIComponent(order.number)}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary/40 bg-card px-4 py-3.5 text-sm font-semibold text-primary transition-[background-color,transform] duration-100 hover:bg-primary/5 active:scale-[0.99]"
          >
            <XCircle className="size-[18px]" aria-hidden="true" />
            Cancelar pedido
          </Link>
        ) : null}
      </div>
    </div>
  );
}
