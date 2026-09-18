'use client';

import { Check, Clock, AlertCircle } from 'lucide-react';
import { useCheckout } from '@/contexts/CheckoutContext';
import { cn } from '@/lib/cn';
import {
  formatScheduleSummary,
  groupTimesByPeriod,
  relativeDayLabel,
  scheduleDateParts,
} from '@/app/checkout/recebimento/recebimento-helpers';

type Props = {
  availableDates: string[];
  availableTimes: string[];
};

export function ScheduleSection({ availableDates, availableTimes }: Props) {
  const { checkout, setScheduledDate, setScheduledTime } = useCheckout();

  // O primeiro horário da primeira data disponível é o mais cedo que dá pra
  // atender — mesmo cálculo de antecedência mínima que já vale pro resto da
  // grade, só que em destaque em vez de escondido atrás de um botão "Agora".
  const isEarliestDate =
    availableDates.length > 0 && checkout.scheduledDate === availableDates[0];
  const earliestTime = isEarliestDate ? availableTimes[0] : undefined;
  const restOfTimes = earliestTime
    ? availableTimes.slice(1)
    : availableTimes;

  return (
    <>
      <p className="text-base font-semibold">Quando você quer receber?</p>

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
                onClick={() => setScheduledDate(key)}
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

        <p className="text-sm font-semibold">Escolha o horário</p>
        {availableTimes.length === 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>Sem horários para esta data. Tente outro dia.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {earliestTime ? (
              <button
                type="button"
                onClick={() => setScheduledTime(earliestTime)}
                aria-pressed={checkout.scheduledTime === earliestTime}
                className={cn(
                  'flex w-full items-center justify-center gap-1.5 rounded-lg border-[1.5px] py-2.5 text-sm font-semibold tabular-nums transition-[background-color,border-color,transform] duration-100 active:scale-[0.98]',
                  checkout.scheduledTime === earliestTime
                    ? 'border-primary bg-primary text-white'
                    : 'border-primary/40 bg-primary/[0.06] text-foreground',
                )}
              >
                {checkout.scheduledTime === earliestTime ? (
                  <Check className="size-3.5" />
                ) : null}
                {earliestTime}
                <span
                  className={cn(
                    'text-xs font-medium',
                    checkout.scheduledTime === earliestTime
                      ? 'text-white/80'
                      : 'text-primary',
                  )}
                >
                  · mais cedo possível
                </span>
              </button>
            ) : null}

            {groupTimesByPeriod(restOfTimes).map((group) => (
              <div key={group.id} className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {group.times.map((time) => {
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
                        {selected ? <Check className="size-3.5" /> : null}
                        {time}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {checkout.scheduledDate && checkout.scheduledTime ? (
          <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2.5 text-sm">
            <Clock className="size-4 shrink-0 text-primary" />
            <p className="leading-snug">
              {checkout.deliveryType === 'pickup' ? 'Retirada ' : 'Entrega '}
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
    </>
  );
}
