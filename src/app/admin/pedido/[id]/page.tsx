'use client';

import { use, useCallback, useEffect, useState } from 'react';
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
import { nextAdminStatus, type AdminOrderDetail } from '@/modules/admin/types';
import { useAdminOrdersRealtime } from '@/modules/realtime/hooks';
import { adminContainerClass } from '@/lib/layout';
import { cn } from '@/lib/cn';

export default function AdminPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { isAuthenticated, ready } = useRequireAdmin();
  const { prompt, alert } = useAppDialog();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { version: realtimeVersion } = useAdminOrdersRealtime(
    ready && isAuthenticated,
  );

  const loadOrder = useCallback(
    async (opts?: { background?: boolean }) => {
      try {
        const response = await fetch(`/api/v1/admin/orders/${id}`, {
          cache: 'no-store',
        });
        const json = await response.json();
        if (!response.ok) {
          setError(json?.error?.message ?? 'Pedido não encontrado.');
          setOrder(null);
          return;
        }
        setOrder(json.order as AdminOrderDetail);
        setError(null);
      } catch {
        setError('Falha de rede.');
      } finally {
        // Só a carga inicial controla o spinner; refetch de Realtime nunca,
        // senão uma reconexão do socket trava a tela em "carregando".
        if (!opts?.background) setLoading(false);
      }
    },
    [id],
  );

  // Carga inicial: dona do `loading`, roda ao ficar pronto e ao trocar de pedido.
  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    setLoading(true);
    void loadOrder();
  }, [ready, isAuthenticated, loadOrder]);

  // Atualização via Realtime: refetch em segundo plano, sem tocar no `loading`.
  useEffect(() => {
    if (!ready || !isAuthenticated || realtimeVersion === 0) return;
    void loadOrder({ background: true });
  }, [ready, isAuthenticated, realtimeVersion, loadOrder]);

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

  // Chama a rota de cancelamento. Serve tanto para cancelar o pedido quanto,
  // num pedido já cancelado, para reenviar só o estorno do Pix (o backend
  // detecta o estado e faz a coisa certa).
  const postCancel = async (reason: string, netError: string) => {
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
        setError(json?.error?.message ?? netError);
        return;
      }
      setOrder(json.order as AdminOrderDetail);
      return json.refund as 'done' | 'already' | 'failed' | undefined;
    } catch {
      setError(netError);
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
    const refund = await postCancel(reason, 'Falha de rede ao cancelar.');
    if (refund === 'done') {
      await alert({
        title: 'Pedido cancelado',
        description: 'O estorno do Pix foi solicitado ao Mercado Pago.',
      });
    } else if (refund === 'failed') {
      await alert({
        title: 'Pedido cancelado, mas o estorno falhou',
        description:
          'Reenvie o estorno pelo botão "Tentar estorno do Pix de novo" ou estorne manualmente no painel do Mercado Pago.',
      });
    }
  };

  const retryRefund = async () => {
    if (!order) return;
    const refund = await postCancel(
      'Reenvio do estorno Pix',
      'Falha de rede ao estornar.',
    );
    if (refund === 'done' || refund === 'already') {
      await alert({
        title: 'Estorno enviado',
        description: 'O estorno do Pix foi enviado ao Mercado Pago.',
      });
    } else if (refund === 'failed') {
      await alert({
        title: 'O estorno falhou de novo',
        description: 'Estorne manualmente pelo painel do Mercado Pago.',
      });
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
          'p-3 pb-8 md:px-6 md:pt-6',
          adminContainerClass,
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
                    {order.paymentMethod === 'pix'
                      ? ` · ${
                          order.paymentStatus === 'confirmed'
                            ? 'Pago'
                            : order.paymentStatus === 'refunded'
                              ? 'Estornado'
                              : order.paymentStatus === 'failed'
                                ? 'Não pago'
                                : order.paymentStatus === 'cancelled'
                                  ? 'Cancelado'
                                  : 'Aguardando'
                        }`
                      : ''}
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
              <section className="rounded-lg border border-transparent bg-tone-warning p-3.5 text-tone-warning-foreground">
                <h2 className="text-sm font-bold">Nota interna</h2>
                <p className="mt-1 text-xs opacity-80">{order.internalNote}</p>
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

            {error ? <p className="text-xs text-destructive">{error}</p> : null}

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

            {order.status === 'cancelled' &&
            order.paymentMethod === 'pix' &&
            order.paymentStatus === 'confirmed' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void retryRefund()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/40 py-3 text-sm font-semibold text-destructive disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Tentar estorno do Pix de novo
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
