'use client';

import { Suspense, use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Receipt,
  CheckCircle2,
  Wrench,
  Package,
  Bike,
  Home,
  MapPin,
  ChevronRight,
  RefreshCw,
  XCircle,
  Check,
  ChefHat,
  Soup,
} from 'lucide-react';
import { formatCatalogPrice } from '@/modules/catalog/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useCart } from '@/modules/carts';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import {
  statusLabel,
  STATUS_COPY,
  type CustomerOrder,
  type OrderStatus,
} from '@/modules/orders/types';
import { useCustomerOrderRealtime } from '@/modules/realtime/hooks';
import { cn } from '@/lib/utils';

type Step = {
  id: OrderStatus;
  label: string;
  icon: React.ElementType;
};

const DELIVERY_STEPS: Step[] = [
  { id: 'received', label: 'Pedido recebido', icon: Receipt },
  { id: 'confirmed', label: 'Confirmado', icon: CheckCircle2 },
  { id: 'in_production', label: 'Em produção', icon: Wrench },
  { id: 'ready_for_delivery', label: 'Pronto para entrega', icon: Package },
  { id: 'out_for_delivery', label: 'Saiu para entrega', icon: Bike },
  { id: 'delivered', label: 'Entregue', icon: Home },
];

const PICKUP_STEPS: Step[] = [
  { id: 'received', label: 'Pedido recebido', icon: Receipt },
  { id: 'confirmed', label: 'Confirmado', icon: CheckCircle2 },
  { id: 'in_production', label: 'Em produção', icon: Wrench },
  { id: 'ready_for_pickup', label: 'Pronto para retirada', icon: Package },
  { id: 'delivered', label: 'Retirado', icon: Home },
];

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function historyTimeForStep(
  status: OrderStatus,
  history: CustomerOrder['history'],
  createdAt: string,
): string {
  const entry = [...history]
    .reverse()
    .find((item) => item.newStatus === status);
  if (entry) return formatClock(entry.createdAt);
  if (status === 'received') return formatClock(createdAt);
  return '--:--';
}

function AcompanhamentoContent({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const router = useRouter();
  const { replaceItems } = useCart();
  const { notify } = useShopExperience();

  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { version: realtimeVersion } = useCustomerOrderRealtime(id, true);

  const loadOrder = useCallback(
    async (opts?: { background?: boolean }) => {
      try {
        const response = await fetch(`/api/v1/orders/${id}`, {
          cache: 'no-store',
        });
        const json = await response.json();
        if (!response.ok) {
          setError(json?.error?.message ?? 'Pedido não encontrado.');
          setOrder(null);
          return;
        }
        setOrder(json.order as CustomerOrder);
        setError(null);
      } catch {
        setError('Falha de rede ao carregar o pedido.');
      } finally {
        // Só a carga inicial controla o skeleton; refetch em segundo plano
        // nunca, senão uma oscilação do Realtime trava a tela.
        if (!opts?.background) setLoading(false);
      }
    },
    [id],
  );

  // Carga inicial: dona do `loading`, roda uma vez por pedido.
  useEffect(() => {
    setLoading(true);
    void loadOrder();
  }, [loadOrder]);

  // Fallback periódico caso o Realtime falhe/desconecte — em segundo plano.
  useEffect(() => {
    const fallback = window.setInterval(() => {
      void loadOrder({ background: true });
    }, 45_000);
    return () => window.clearInterval(fallback);
  }, [loadOrder]);

  // Sinal do Realtime: refetch em segundo plano, sem tocar no `loading`.
  useEffect(() => {
    if (realtimeVersion === 0) return;
    void loadOrder({ background: true });
  }, [realtimeVersion, loadOrder]);

  const handleReorder = async () => {
    try {
      const response = await fetch(`/api/v1/orders/${id}/reorder`, {
        method: 'POST',
      });
      const json = await response.json();
      if (!response.ok) {
        notify(json?.error?.message ?? 'Não foi possível pedir novamente.');
        return;
      }
      if (!json.items?.length) {
        notify('Nenhum item disponível para recompra.');
        return;
      }
      replaceItems(json.items);
      notify('Itens adicionados ao carrinho.');
      router.push('/carrinho');
    } catch {
      notify('Falha de rede na recompra.');
    }
  };

  if (loading && !order) {
    return (
      <div
        className="mx-auto w-full max-w-md space-y-3.5 px-4 py-5"
        aria-label="Carregando pedido"
      >
        <div className="space-y-3 rounded-xl border border-border bg-card px-4 py-5 text-center">
          <Skeleton className="mx-auto size-16 rounded-full" />
          <Skeleton className="mx-auto h-6 w-40" />
          <Skeleton className="mx-auto h-3 w-56" />
        </div>
        <div className="space-y-4 rounded-xl border border-border bg-card p-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3.5">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-3.5 w-10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-sm text-destructive">
          {error ?? 'Pedido não encontrado.'}
        </p>
        <Link href="/pedidos" className="text-sm font-medium text-primary">
          Voltar aos pedidos
        </Link>
      </div>
    );
  }

  const steps =
    order.deliveryMethod === 'pickup' ? PICKUP_STEPS : DELIVERY_STEPS;
  const isCancelled = order.status === 'cancelled';
  const currentStep = isCancelled
    ? -1
    : steps.findIndex((s) => s.id === order.status);
  const CurrentIcon = steps[Math.max(currentStep, 0)]?.icon ?? Receipt;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background lg:max-w-5xl">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-3 py-2.5 lg:px-0">
        <button
          type="button"
          aria-label="Voltar aos pedidos"
          onClick={() =>
            from === 'confirmation'
              ? router.replace('/pedidos')
              : router.push('/pedidos')
          }
          className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft className="size-6" />
        </button>
        <h1 className="font-serif text-lg font-semibold text-foreground">
          Pedido {order.number}
        </h1>
        <span className="w-10" aria-hidden="true" />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3 pb-6 lg:grid lg:grid-cols-3 lg:items-start lg:gap-5 lg:px-0">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <section
            aria-live="polite"
            className={cn(
              'relative overflow-hidden rounded-2xl border px-4 py-5 text-center',
              isCancelled
                ? 'border-destructive/25 bg-destructive/10'
                : 'border-primary/20 bg-gradient-to-b from-primary/15 via-primary/8 to-card',
            )}
          >
            {!isCancelled ? (
              <>
                <ChefHat
                  aria-hidden="true"
                  className="pointer-events-none absolute left-6 top-5 size-16 rotate-[-12deg] text-primary/10"
                  strokeWidth={1.25}
                />
                <Soup
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-4 right-5 size-14 rotate-[8deg] text-primary/10"
                  strokeWidth={1.25}
                />
              </>
            ) : null}

            <div
              className={cn(
                'relative mx-auto flex size-16 items-center justify-center rounded-full border shadow-sm',
                isCancelled
                  ? 'border-destructive/30 bg-card text-destructive'
                  : 'border-primary/20 bg-card text-primary',
              )}
            >
              {isCancelled ? (
                <XCircle className="size-8" strokeWidth={1.75} />
              ) : (
                <CurrentIcon className="size-8" strokeWidth={1.75} />
              )}
            </div>

            <h2
              className={cn(
                'relative mt-3 font-serif text-xl font-semibold',
                isCancelled ? 'text-destructive' : 'text-primary',
              )}
            >
              {statusLabel(order.status)}
            </h2>
            <p className="relative mx-auto mt-2 max-w-[28ch] text-sm leading-relaxed text-muted-foreground">
              {STATUS_COPY[order.status]}
            </p>

            {order.scheduledFor ? (
              <p className="relative mt-3 text-sm text-muted-foreground">
                Agendado para:{' '}
                {new Date(order.scheduledFor).toLocaleDateString('pt-BR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            ) : null}

            {isCancelled && order.cancellationReason ? (
              <p className="relative mt-3 text-sm text-muted-foreground">
                Motivo: {order.cancellationReason}
              </p>
            ) : null}
          </section>

          {!isCancelled ? (
            <section
              aria-label="Andamento do pedido"
              className="rounded-xl border border-border bg-card p-3.5"
            >
              <ol className="flex flex-col">
                {steps.map((step, i) => {
                  const done = i < currentStep;
                  const active = i === currentStep;
                  const pending = i > currentStep;
                  const Icon = step.icon;
                  const time = pending
                    ? '--:--'
                    : historyTimeForStep(
                        step.id,
                        order.history,
                        order.createdAt,
                      );

                  return (
                    <li key={step.id} className="flex gap-3.5">
                      <div className="flex w-8 flex-col items-center">
                        <div
                          className={cn(
                            'flex size-8 shrink-0 items-center justify-center rounded-full border-2',
                            done &&
                              'border-primary bg-primary text-primary-foreground',
                            active &&
                              'border-primary bg-primary text-primary-foreground',
                            pending &&
                              'border-border bg-card text-muted-foreground',
                          )}
                        >
                          {done ? (
                            <Check className="size-4" strokeWidth={2.5} />
                          ) : active ? (
                            <span className="text-xs font-bold">{i + 1}</span>
                          ) : (
                            <Icon className="size-4" strokeWidth={1.75} />
                          )}
                        </div>
                        {i < steps.length - 1 ? (
                          <div
                            className={cn(
                              'my-1 w-0.5 flex-1 min-h-5',
                              i < currentStep
                                ? 'bg-primary'
                                : 'border-l-2 border-dashed border-border bg-transparent w-0',
                            )}
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>

                      <div
                        className={cn(
                          'flex flex-1 items-start justify-between gap-3 pb-5',
                          i === steps.length - 1 && 'pb-0',
                        )}
                      >
                        <p
                          className={cn(
                            'pt-1.5 text-sm',
                            active && 'font-semibold text-foreground',
                            done && 'font-medium text-foreground',
                            pending && 'text-muted-foreground',
                          )}
                        >
                          {step.label}
                        </p>
                        <time
                          className={cn(
                            'pt-1.5 text-xs tabular-nums',
                            pending
                              ? 'text-muted-foreground/70'
                              : 'text-muted-foreground',
                          )}
                        >
                          {time}
                        </time>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          {order.history.length > 0 ? (
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-serif text-lg font-semibold text-foreground">
                Histórico
              </h2>
              <ul className="mt-3 space-y-2">
                {order.history.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {statusLabel(entry.newStatus)}
                      </p>
                      {entry.reason ? (
                        <p className="text-xs text-muted-foreground">
                          {entry.reason}
                        </p>
                      ) : null}
                    </div>
                    <time className="shrink-0 text-xs text-muted-foreground">
                      {formatClock(entry.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

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
                <span className="text-sm font-semibold text-foreground">
                  Total
                </span>
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
                onClick={() => void handleReorder()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-semibold text-foreground transition-[background-color,transform] duration-100 hover:bg-accent active:scale-[0.99]"
              >
                <RefreshCw className="size-[18px]" aria-hidden="true" />
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
      </div>
    </div>
  );
}

export default function AcompanhamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
          Carregando...
        </div>
      }
    >
      <AcompanhamentoContent id={id} />
    </Suspense>
  );
}
