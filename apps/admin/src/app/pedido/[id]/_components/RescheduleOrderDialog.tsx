'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  RescheduleDateTimePicker,
  formatCurrentScheduleLabel,
} from '@/modules/orders/RescheduleDateTimePicker';
import type { OrderRescheduleOptions } from '@/modules/orders/reschedule';

type Props = {
  orderNumber: string;
  options: OrderRescheduleOptions | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (scheduledDate: string, scheduledTime: string) => void;
};

export function RescheduleOrderDialog({
  orderNumber,
  options,
  loading,
  error,
  onClose,
  onConfirm,
}: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const isValid = Boolean(selectedDate && selectedTime);

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Reagendar pedido {orderNumber}</h2>

        {options ? (
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Agendado atualmente para{' '}
            <span className="font-semibold text-foreground">
              {formatCurrentScheduleLabel(options.currentScheduledFor)}
            </span>
            .
          </p>
        ) : null}

        <div className="mt-3">
          {loading && !options ? (
            <p className="text-sm text-muted-foreground">
              Carregando horários…
            </p>
          ) : options ? (
            <RescheduleDateTimePicker
              availableDates={options.availableDates}
              timesByDate={options.timesByDate}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setSelectedTime(null);
              }}
              onSelectTime={setSelectedTime}
            />
          ) : null}

          {error ? (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          ) : null}
        </div>

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-border bg-background py-3 text-sm font-semibold text-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!isValid || loading}
            onClick={() =>
              selectedDate &&
              selectedTime &&
              onConfirm(selectedDate, selectedTime)
            }
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading && options ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
