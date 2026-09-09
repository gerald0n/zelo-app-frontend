'use client';

import Link from 'next/link';
import { Check, ChefHat, Receipt, Soup, XCircle } from 'lucide-react';
import {
  statusLabel,
  STATUS_COPY,
  isAwaitingPixPayment,
  customerFacingStatus,
  type CustomerOrder,
} from '@/modules/orders/types';
import { cn } from '@/lib/utils';
import {
  DELIVERY_STEPS,
  PICKUP_STEPS,
  formatClock,
  historyTimeForStep,
} from '@/app/acompanhamento/[id]/acompanhamento-steps';

function scheduledForLabel(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OrderTimeline({ order }: { order: CustomerOrder }) {
  const steps =
    order.deliveryMethod === 'pickup' ? PICKUP_STEPS : DELIVERY_STEPS;
  const isCancelled = order.status === 'cancelled';
  const awaitingPayment = isAwaitingPixPayment(order);
  // "Pronto para entrega" é apresentado como "Saiu para entrega" para o cliente.
  const displayStatus = customerFacingStatus(order.status);
  const currentStep = isCancelled
    ? -1
    : steps.findIndex((s) => s.id === displayStatus);
  const CurrentIcon = steps[Math.max(currentStep, 0)]?.icon ?? Receipt;
  // "Pronto para entrega" não é um estado que o cliente vê — some do histórico
  // (o horário dele ainda acende a etapa "Saiu para entrega" no passo a passo).
  const historyEntries = order.history.filter(
    (entry) => entry.newStatus !== 'ready_for_delivery',
  );

  return (
    <div className="flex flex-col gap-3 lg:col-span-2">
      {awaitingPayment ? (
        <section
          aria-live="polite"
          className="rounded-2xl border border-tone-warning-foreground/25 bg-tone-warning/50 px-4 py-5 text-center"
        >
          <p className="font-serif text-xl font-semibold text-tone-warning-foreground">
            Aguardando pagamento
          </p>
          <p className="mx-auto mt-2 max-w-[32ch] text-sm leading-relaxed text-tone-warning-foreground/90">
            Este pedido só entra na fila da confeitaria depois que o Pix for
            confirmado. Assim que o pagamento cair, ele avança sozinho.
          </p>
          {order.scheduledFor ? (
            <p className="mt-2 text-sm text-tone-warning-foreground/80">
              Agendado para: {scheduledForLabel(order.scheduledFor)}
            </p>
          ) : null}
          <Link
            href={`/checkout/pix/${order.id}`}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform duration-100 active:scale-[0.99]"
          >
            Finalizar pagamento Pix
          </Link>
        </section>
      ) : null}
      <section
        aria-live="polite"
        hidden={awaitingPayment}
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
          {statusLabel(displayStatus)}
        </h2>
        <p className="relative mx-auto mt-2 max-w-[28ch] text-sm leading-relaxed text-muted-foreground">
          {STATUS_COPY[displayStatus]}
        </p>

        {order.scheduledFor ? (
          <p className="relative mt-3 text-sm text-muted-foreground">
            Agendado para: {scheduledForLabel(order.scheduledFor)}
          </p>
        ) : null}

        {isCancelled && order.cancellationReason ? (
          <p className="relative mt-3 text-sm text-muted-foreground">
            Motivo: {order.cancellationReason}
          </p>
        ) : null}
      </section>

      {!isCancelled && !awaitingPayment ? (
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
                : historyTimeForStep(step.id, order.history, order.createdAt);

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

      {historyEntries.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-serif text-lg font-semibold text-foreground">
            Histórico
          </h2>
          <ul className="mt-3 space-y-2">
            {historyEntries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-medium">{statusLabel(entry.newStatus)}</p>
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
  );
}
