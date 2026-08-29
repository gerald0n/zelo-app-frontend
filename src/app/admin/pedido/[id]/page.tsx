'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bike,
  ShoppingBag,
  CreditCard,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import AdminHeader from '@/components/admin/AdminHeader';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { formatCatalogPrice } from '@/modules/catalog/types';
import { statusLabel, type OrderStatus } from '@/modules/orders/types';
import {
  nextAdminStatus,
  type AdminOrderDetail,
} from '@/modules/admin/types';
import { useAdminOrdersRealtime } from '@/modules/realtime/hooks';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { cn } from '@/lib/cn';

export default function AdminPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { isAuthenticated, ready } = useRequireAdmin();
  const { prompt } = useAppDialog();
  const { isTablet } = useResponsiveLayout();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { version: realtimeVersion } = useAdminOrdersRealtime(
    ready && isAuthenticated,
  );

  useEffect(() => {
    if (!ready || !isAuthenticated) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/v1/admin/orders/${id}`, {
          cache: 'no-store',
        });
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setError(json?.error?.message ?? 'Pedido não encontrado.');
          setOrder(null);
          return;
        }
        setOrder(json.order as AdminOrderDetail);
        setError(null);
      } catch {
        if (!cancelled) setError('Falha de rede.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ready, isAuthenticated, id, realtimeVersion]);


  const advance = async () => {
    if (!order) return;
    const next = nextAdminStatus(order.status, order.deliveryMethod);
    if (!next) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/admin/orders/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus: next }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json?.error?.message ?? 'Não foi possível atualizar.');
        return;
      }
      setOrder(json.order as AdminOrderDetail);
    } catch {
      setError('Falha de rede ao atualizar status.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!order) return;
    const reason = await prompt({
      title: 'Cancelar pedido',
      description: 'Informe o motivo do cancelamento administrativo.',
      placeholder: 'Motivo do cancelamento',
      minLength: 3,
      confirmLabel: 'Cancelar pedido',
    });
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/admin/orders/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json?.error?.message ?? 'Não foi possível cancelar.');
        return;
      }
      setOrder(json.order as AdminOrderDetail);
    } catch {
      setError('Falha de rede ao cancelar.');
    } finally {
      setBusy(false);
    }
  };

  if (!ready || !isAuthenticated || loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background lg:pl-52">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background lg:pl-52">
        <p>{error ?? 'Pedido não encontrado.'}</p>
        <Link href="/admin/pedidos" className="text-primary">
          Voltar aos pedidos
        </Link>
      </div>
    );
  }

  const next = nextAdminStatus(order.status, order.deliveryMethod);

  return (
    <div className="min-h-dvh bg-background lg:pl-52">
      <AdminHeader
        title={order.number}
        subtitle={statusLabel(order.status)}
        backTo="/admin/pedidos"
      />
      <div
        className={cn(
          'p-3 pb-8',
          isTablet && 'mx-auto w-full max-w-[1050px] p-4',
        )}
      >
        <div className="flex flex-wrap">
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
                    {order.deliveryMethod === 'delivery'
                      ? 'Entrega'
                      : 'Retirada'}
                  </p>
                  <p className="mt-0.5 text-xs">
                    {order.address?.formatted ?? 'Retirada na Zelo'}
                  </p>
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
                  </p>
                </div>
              </div>
              {order.customer ? (
                <p className="text-xs text-muted-foreground">
                  Cliente: {order.customer.name} · {order.customer.phoneE164}
                </p>
              ) : null}
            </section>

            {order.internalNote ? (
              <section className="rounded-lg border border-amber-200 bg-amber-50 p-3.5">
                <h2 className="text-sm font-bold text-amber-900">
                  Nota interna
                </h2>
                <p className="mt-1 text-xs text-amber-900/80">
                  {order.internalNote}
                </p>
              </section>
            ) : null}
          </div>

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

            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : null}

            {next ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void advance()}
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
                onClick={() => void cancel()}
                className="w-full rounded-lg border border-destructive/40 py-3 text-sm font-semibold text-destructive disabled:opacity-60"
              >
                Cancelar pedido
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
