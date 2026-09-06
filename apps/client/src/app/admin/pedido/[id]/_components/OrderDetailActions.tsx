'use client';

import { ArrowRight, Loader2, Printer } from 'lucide-react';
import { formatCatalogPrice } from '@/modules/catalog/types';
import { statusLabel, type OrderStatus } from '@/modules/orders/types';
import { nextAdminStatus, type AdminOrderDetail } from '@/modules/admin/types';

type Props = {
  order: AdminOrderDetail;
  busy: boolean;
  error: string | null;
  hasStore: boolean;
  printerReady: boolean;
  onAdvance: () => void;
  onCancel: () => void;
  onRetryRefund: () => void;
  onReprintTicket: () => void;
  onReprintSlip: () => void;
};

export function OrderDetailActions({
  order,
  busy,
  error,
  hasStore,
  printerReady,
  onAdvance,
  onCancel,
  onRetryRefund,
  onReprintTicket,
  onReprintSlip,
}: Props) {
  const next = nextAdminStatus(order.status, order.deliveryMethod);

  return (
    <div className="mt-3 w-full space-y-3 lg:mt-0 lg:w-1/3 lg:pl-3">
      <section className="space-y-2 rounded-lg border border-border p-3.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCatalogPrice(order.subtotalCents)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Entrega</span>
          <span>
            {order.deliveryFeeCents === 0
              ? 'Grátis'
              : formatCatalogPrice(order.deliveryFeeCents)}
          </span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 text-sm font-bold">
          <span>Total</span>
          <span>{formatCatalogPrice(order.totalCents)}</span>
        </div>
      </section>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {next ? (
        <button
          type="button"
          disabled={busy}
          onClick={onAdvance}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Avançar para &quot;{statusLabel(next as OrderStatus)}&quot;
          <ArrowRight className="size-4" />
        </button>
      ) : null}

      {order.status !== 'delivered' && order.status !== 'cancelled' ? (
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="w-full rounded-lg border border-destructive/40 py-3 text-sm font-semibold text-destructive disabled:opacity-60"
        >
          Cancelar pedido
        </button>
      ) : null}

      {printerReady ? (
        <>
          <button
            type="button"
            onClick={onReprintTicket}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-3 text-sm font-semibold"
          >
            <Printer className="size-4" />
            Reimprimir comanda
          </button>
          <button
            type="button"
            disabled={!hasStore}
            onClick={onReprintSlip}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-3 text-sm font-semibold disabled:opacity-60"
          >
            <Printer className="size-4" />
            Reimprimir pedido
          </button>
        </>
      ) : (
        <p className="text-2xs text-muted-foreground">
          Impressora não pareada — pareie em Configurações pra reimprimir.
        </p>
      )}

      {order.status === 'cancelled' &&
      order.paymentMethod === 'pix' &&
      order.paymentStatus === 'confirmed' ? (
        <button
          type="button"
          disabled={busy}
          onClick={onRetryRefund}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/40 py-3 text-sm font-semibold text-destructive disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Tentar estorno do Pix de novo
        </button>
      ) : null}
    </div>
  );
}
