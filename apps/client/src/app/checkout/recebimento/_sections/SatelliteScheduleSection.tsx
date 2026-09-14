'use client';

import { useEffect } from 'react';
import { Zap, Calendar, Clock, MapPin, AlertCircle } from 'lucide-react';
import { useCheckout } from '@/contexts/CheckoutContext';
import { cn } from '@/lib/cn';
import {
  relativeDayLabel,
  scheduleDateParts,
  formatScheduleSummary,
} from '@/app/checkout/recebimento/recebimento-helpers';
import type { SatelliteDeliverySlotOption } from '@/app/checkout/recebimento/recebimento-helpers';

type Props = {
  /** "Agora" só existe pra retirada, quando a unidade está aberta agora. */
  allowImmediate: boolean;
  availableDates: string[];
  pickupWindowByDate: Record<string, { opensAt: string; closesAt: string }>;
  deliverySlotsByDate: Record<string, SatelliteDeliverySlotOption[]>;
  addressLine: string;
  city: string;
  state: string;
};

function formatSlotLabel(slot: SatelliteDeliverySlotOption): string {
  if (slot.label) return `${slot.label} · ${slot.startsAt.slice(0, 5)}`;
  if (slot.endsAt) {
    return `${slot.startsAt.slice(0, 5)}–${slot.endsAt.slice(0, 5)}`;
  }
  return slot.startsAt.slice(0, 5);
}

/**
 * Agenda do local satélite (São Miguel/RN): dias fixos qua-sex, retirada
 * "qualquer horário" numa janela (sem seletor) e uma lista curta de
 * horários fixos de entrega — deliberadamente separada de `ScheduleSection`
 * (motor de agendamento diferente, ver `scheduling/satellite-slots.ts`).
 */
export function SatelliteScheduleSection({
  allowImmediate,
  availableDates,
  pickupWindowByDate,
  deliverySlotsByDate,
  addressLine,
  city,
  state,
}: Props) {
  const {
    checkout,
    setScheduleType,
    setScheduledDate,
    setScheduledTime,
  } = useCheckout();

  const isPickup = checkout.deliveryType === 'pickup';
  const window = checkout.scheduledDate
    ? pickupWindowByDate[checkout.scheduledDate]
    : undefined;
  const slots = checkout.scheduledDate
    ? (deliverySlotsByDate[checkout.scheduledDate] ?? [])
    : [];

  // Retirada não tem seletor de horário: a data já carrega o horário
  // (início da janela) assim que é escolhida.
  useEffect(() => {
    if (isPickup && checkout.scheduledDate && window && !checkout.scheduledTime) {
      setScheduledTime(window.opensAt.slice(0, 5));
    }
  }, [isPickup, checkout.scheduledDate, checkout.scheduledTime, window, setScheduledTime]);

  const selectDate = (date: string) => {
    setScheduledDate(date);
    if (isPickup) {
      const nextWindow = pickupWindowByDate[date];
      if (nextWindow) setScheduledTime(nextWindow.opensAt.slice(0, 5));
    } else {
      setScheduledTime('');
    }
  };

  return (
    <>
      <p className="text-base font-semibold">Quando?</p>
      <div className="flex min-w-0 gap-2.5">
        <button
          type="button"
          disabled={!allowImmediate}
          onClick={() => allowImmediate && setScheduleType('now')}
          className={cn(
            'flex flex-1 flex-col items-center gap-1.5 rounded-md border-[1.5px] py-3.5 transition-[background-color,border-color,transform] duration-100 active:scale-[0.98]',
            checkout.scheduleType === 'now'
              ? 'border-primary bg-primary/[0.07]'
              : 'border-border bg-card',
            !allowImmediate && 'opacity-40',
          )}
        >
          <Zap
            className={cn(
              'size-[22px]',
              checkout.scheduleType === 'now'
                ? 'text-primary'
                : 'text-muted-foreground',
            )}
          />
          <span
            className={cn(
              'text-sm',
              checkout.scheduleType === 'now'
                ? 'font-semibold text-primary'
                : 'text-foreground',
            )}
          >
            Agora
          </span>
          {!allowImmediate ? (
            <span className="text-2xs text-muted-foreground">
              {isPickup ? 'Unidade fechada' : 'Só agendado'}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setScheduleType('scheduled')}
          className={cn(
            'flex flex-1 flex-col items-center gap-1.5 rounded-md border-[1.5px] py-3.5 transition-[background-color,border-color,transform] duration-100 active:scale-[0.98]',
            checkout.scheduleType === 'scheduled'
              ? 'border-primary bg-primary/[0.07]'
              : 'border-border bg-card',
          )}
        >
          <Calendar
            className={cn(
              'size-[22px]',
              checkout.scheduleType === 'scheduled'
                ? 'text-primary'
                : 'text-muted-foreground',
            )}
          />
          <span
            className={cn(
              'text-sm',
              checkout.scheduleType === 'scheduled'
                ? 'font-semibold text-primary'
                : 'text-foreground',
            )}
          >
            Agendar
          </span>
        </button>
      </div>

      {checkout.scheduleType === 'scheduled' ? (
        <div className="mt-1 space-y-3">
          <p className="text-sm font-semibold">Escolha o dia</p>
          <div className="no-scrollbar -mx-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-1">
            {availableDates.map((key) => {
              const selected = checkout.scheduledDate === key;
              const parts = scheduleDateParts(key);
              const relative = relativeDayLabel(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectDate(key)}
                  aria-pressed={selected}
                  className={cn(
                    'flex w-[62px] shrink-0 snap-start flex-col items-center gap-0.5 rounded-xl border-[1.5px] py-2 transition-[background-color,border-color,transform] duration-100 active:scale-[0.97]',
                    selected
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-card text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wide',
                      selected ? 'text-white/80' : 'text-muted-foreground',
                    )}
                  >
                    {relative ?? parts.weekday}
                  </span>
                  <span className="text-lg font-bold leading-none tabular-nums">
                    {parts.day}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-medium uppercase',
                      selected ? 'text-white/80' : 'text-muted-foreground',
                    )}
                  >
                    {parts.month}
                  </span>
                </button>
              );
            })}
          </div>

          {checkout.scheduledDate && isPickup ? (
            <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm leading-5 text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              <p>
                Retirada entre {window?.opensAt.slice(0, 5)} e{' '}
                {window?.closesAt.slice(0, 5)} em {addressLine}, {city}/{state}
                .
              </p>
            </div>
          ) : null}

          {checkout.scheduledDate && !isPickup ? (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Escolha o horário</p>
              {slots.length === 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p>Sem horários de entrega para esta data.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {slots.map((slot) => {
                    const time = slot.startsAt.slice(0, 5);
                    const selected = checkout.scheduledTime === time;
                    return (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setScheduledTime(time)}
                        aria-pressed={selected}
                        className={cn(
                          'flex items-center justify-center gap-1 rounded-lg border-[1.5px] py-2 text-sm font-semibold tabular-nums transition-[background-color,border-color,transform] duration-100 active:scale-[0.97]',
                          selected
                            ? 'border-primary bg-primary text-white'
                            : 'border-border bg-card text-foreground',
                        )}
                      >
                        {formatSlotLabel(slot)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {checkout.scheduledDate && checkout.scheduledTime && !isPickup ? (
            <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2.5 text-sm">
              <Clock className="size-4 shrink-0 text-primary" />
              <p className="leading-snug">
                Entrega{' '}
                <span className="font-semibold">
                  {formatScheduleSummary(
                    checkout.scheduledDate,
                    checkout.scheduledTime,
                  )}
                </span>
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
