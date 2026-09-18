'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA');
}

function relativeDayLabel(iso: string): string | null {
  const today = new Date(`${todayIso()}T12:00:00`);
  const target = new Date(`${iso}T12:00:00`);
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000,
  );
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  return null;
}

function dateParts(iso: string): { weekday: string; day: string; month: string } {
  const date = new Date(`${iso}T12:00:00`);
  return {
    weekday: date
      .toLocaleDateString('pt-BR', { weekday: 'short' })
      .replace('.', ''),
    day: date.toLocaleDateString('pt-BR', { day: '2-digit' }),
    month: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
  };
}

export function formatScheduleSummary(iso: string, time: string): string {
  const date = new Date(`${iso}T12:00:00`);
  const relative = relativeDayLabel(iso);
  const label = date.toLocaleDateString('pt-BR', {
    weekday: relative ? undefined : 'long',
    day: '2-digit',
    month: 'long',
  });
  const prefix = relative ? `${relative}, ` : '';
  return `${prefix}${label} às ${time}`;
}

/**
 * Formata o `scheduled_for` ATUAL do pedido (timestamptz completo, em UTC) —
 * diferente de `formatScheduleSummary`, que recebe data/hora já em wall-clock
 * local (vindas de `availableDates`/`timesByDate`). Aqui é preciso deixar o
 * `Date` converter o instante UTC pro horário local antes de formatar, ou a
 * hora exibida fica errada pelo offset da loja.
 */
export function formatCurrentScheduleLabel(scheduledForIso: string): string {
  const date = new Date(scheduledForIso);
  const dateIso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return formatScheduleSummary(dateIso, time);
}

type Props = {
  availableDates: string[];
  timesByDate: Record<string, string[]>;
  selectedDate: string | null;
  selectedTime: string | null;
  onSelectDate: (date: string) => void;
  onSelectTime: (time: string) => void;
};

/**
 * Grade de dia + horário pra reagendar um pedido — normalizada pelo backend
 * (`getOrderRescheduleOptions`) pra um único formato, independente de ser um
 * pedido de Pereiro (grade por intervalo) ou de uma unidade satélite (janela
 * de retirada / slots fixos de entrega).
 */
export function RescheduleDateTimePicker({
  availableDates,
  timesByDate,
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
}: Props) {
  const times = selectedDate ? (timesByDate[selectedDate] ?? []) : [];

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-sm font-semibold">Escolha o dia</p>
        <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
          {availableDates.map((date) => {
            const selected = selectedDate === date;
            const parts = dateParts(date);
            const relative = relativeDayLabel(date);
            return (
              <button
                key={date}
                type="button"
                onClick={() => onSelectDate(date)}
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
      </div>

      {selectedDate ? (
        <div>
          <p className="mb-1.5 text-sm font-semibold">Escolha o horário</p>
          {times.length === 0 ? (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Sem horários para esta data. Tente outro dia.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {times.map((time) => {
                const selected = selectedTime === time;
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => onSelectTime(time)}
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
          )}
        </div>
      ) : null}
    </div>
  );
}
