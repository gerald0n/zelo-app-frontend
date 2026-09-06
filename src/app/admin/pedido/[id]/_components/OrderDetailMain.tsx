'use client';

import { Bike, CreditCard, ShoppingBag } from 'lucide-react';
import { formatCatalogPrice } from '@/modules/catalog/types';
import { statusLabel } from '@/modules/orders/types';
import type { AdminOrderDetail } from '@/modules/admin/types';

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PIX_STATUS_LABEL: Record<string, string> = {
  confirmed: 'Pago',
  refunded: 'Estornado',
  failed: 'Não pago',
  cancelled: 'Cancelado',
};

export function OrderDetailMain({ order }: { order: AdminOrderDetail }) {
  return (
    <div className="w-full space-y-3 px-0 lg:w-2/3 lg:pr-3">
      <section className="space-y-[13px] rounded-lg border border-border p-3.5">
        <h2 className="text-sm font-bold">Itens</h2>
        {order.items.map((item) => (
          <div key={item.id} className="flex items-start gap-2.5">
            <span className="flex size-[31px] items-center justify-center rounded-md bg-muted text-2xs font-bold">
              {item.quantity}×
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{item.name}</p>
              {item.addOns.map((addon) => (
                <p
                  key={`${addon.id}-${addon.name}`}
                  className="mt-0.5 text-2xs text-muted-foreground"
                >
                  + {addon.name}
                </p>
              ))}
              {item.note ? (
                <p className="mt-0.5 text-2xs text-muted-foreground">
                  Obs.: {item.note}
                </p>
              ) : null}
            </div>
            <span className="text-xs font-semibold">
              {formatCatalogPrice(item.lineTotalCents)}
            </span>
          </div>
        ))}
      </section>

      <section className="space-y-[13px] rounded-lg border border-border p-3.5">
        <h2 className="text-sm font-bold">Recebimento</h2>
        <div className="flex gap-2.5">
          {order.deliveryMethod === 'delivery' ? (
            <Bike className="size-[18px] text-muted-foreground" />
          ) : (
            <ShoppingBag className="size-[18px] text-muted-foreground" />
          )}
          <div>
            <p className="text-2xs text-muted-foreground">
              {order.deliveryMethod === 'delivery' ? 'Entrega' : 'Retirada'}
            </p>
            <p className="mt-0.5 text-xs">
              {order.address?.formatted ?? 'Retirada na Zelo'}
            </p>
            {order.address?.referencePoint ? (
              <p className="mt-0.5 text-2xs text-muted-foreground">
                Referência: {order.address.referencePoint}
              </p>
            ) : null}
            {order.scheduledFor ? (
              <p className="mt-0.5 text-2xs text-muted-foreground">
                Agendado para:{' '}
                {new Date(order.scheduledFor).toLocaleString('pt-BR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2.5">
          <CreditCard className="size-[18px] text-muted-foreground" />
          <div>
            <p className="text-2xs text-muted-foreground">Pagamento</p>
            <p className="mt-0.5 text-xs">
              {order.paymentMethod === 'pix'
                ? 'Pix'
                : order.paymentMethod === 'cash'
                  ? 'Dinheiro'
                  : 'Cartão'}
              {order.paymentMethod === 'pix'
                ? ` · ${PIX_STATUS_LABEL[order.paymentStatus] ?? 'Aguardando'}`
                : order.paymentStatus === 'confirmed'
                  ? ' · Pago'
                  : ''}
            </p>
            {order.needsChange && order.changeForAmountCents != null ? (
              <p className="mt-0.5 text-2xs text-muted-foreground">
                Troco para {formatCatalogPrice(order.changeForAmountCents)}
              </p>
            ) : null}
          </div>
        </div>
        {order.customer ? (
          <p className="text-xs text-muted-foreground">
            Cliente: {order.customer.name} · {order.customer.phoneE164}
          </p>
        ) : order.guest ? (
          <p className="text-xs text-muted-foreground">
            Cliente: {order.guest.name} · {order.guest.phoneE164} · Avulso
          </p>
        ) : null}
      </section>

      {order.customerNote ? (
        <section className="space-y-1 rounded-lg border border-border p-3.5">
          <h2 className="text-sm font-bold">Observação do cliente</h2>
          <p className="text-xs text-muted-foreground">{order.customerNote}</p>
        </section>
      ) : null}

      {order.internalNote ? (
        <section className="rounded-lg border border-transparent bg-tone-warning p-3.5 text-tone-warning-foreground">
          <h2 className="text-sm font-bold">Nota interna</h2>
          <p className="mt-1 text-xs opacity-80">{order.internalNote}</p>
        </section>
      ) : null}

      {order.status === 'cancelled' && order.cancellationReason ? (
        <section className="rounded-lg border border-destructive/40 p-3.5">
          <h2 className="text-sm font-bold text-destructive">
            Pedido cancelado
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Motivo: {order.cancellationReason}
          </p>
        </section>
      ) : null}

      {order.history.length > 0 ? (
        <section className="space-y-2 rounded-lg border border-border p-3.5">
          <h2 className="text-sm font-bold">Histórico</h2>
          <ul className="space-y-1.5">
            {order.history.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 text-xs"
              >
                <div>
                  <p className="font-semibold">{statusLabel(entry.newStatus)}</p>
                  {entry.reason ? (
                    <p className="mt-0.5 text-2xs text-muted-foreground">
                      {entry.reason}
                    </p>
                  ) : null}
                </div>
                <time className="shrink-0 text-2xs text-muted-foreground">
                  {formatClock(entry.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
