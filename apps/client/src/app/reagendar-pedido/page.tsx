'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Calendar, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  pageCtaBaseClass,
  pageHeaderBarClass,
  shellNarrowClass,
} from '@/lib/layout';
import {
  RescheduleDateTimePicker,
  formatCurrentScheduleLabel,
} from '@/modules/orders/RescheduleDateTimePicker';

type RescheduleOptions = {
  availableDates: string[];
  timesByDate: Record<string, string[]>;
  currentScheduledFor: string;
};

function ReagendarPedidoContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const orderNumber = searchParams.get('orderNumber') ?? '#----';
  const router = useRouter();

  const [options, setOptions] = useState<RescheduleOptions | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/v1/orders/${orderId}/reschedule`,
          { cache: 'no-store' },
        );
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setLoadError(
            json?.error?.message ?? 'Não foi possível carregar os horários.',
          );
          return;
        }
        setOptions(json.options as RescheduleOptions);
      } catch {
        if (!cancelled) setLoadError('Falha de rede ao carregar horários.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const isValid = Boolean(orderId && selectedDate && selectedTime);

  const handleConfirm = async () => {
    if (!isValid || !orderId || !selectedDate || !selectedTime) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(
        `/api/v1/orders/${orderId}/reschedule`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduledDate: selectedDate,
            scheduledTime: selectedTime,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok) {
        setSubmitError(json?.error?.message ?? 'Não foi possível reagendar.');
        setSubmitting(false);
        return;
      }
      router.replace(`/acompanhamento/${orderId}`);
    } catch {
      setSubmitError('Falha de rede ao reagendar.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className={cn('flex min-h-dvh flex-col bg-background', shellNarrowClass)}
    >
      <header className={pageHeaderBarClass}>
        <Link
          href={orderId ? `/acompanhamento/${orderId}` : '/pedidos'}
          aria-label="Voltar ao pedido"
        >
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="text-lg font-semibold">Reagendar pedido</h1>
        <span className="w-6" />
      </header>

      <div className="flex-1 space-y-3 p-4">
        <div className="flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/[0.06] p-3.5">
          <Calendar className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="flex-1 text-sm leading-5">
            Escolha um novo dia e horário para o pedido {orderNumber}.
            {options ? (
              <>
                {' '}
                Agendado atualmente para{' '}
                <span className="font-semibold">
                  {formatCurrentScheduleLabel(options.currentScheduledFor)}
                </span>
                .
              </>
            ) : null}
          </p>
        </div>

        {!orderId ? (
          <p className="text-sm text-destructive">
            Pedido inválido. Volte e tente novamente.
          </p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Carregando horários…</p>
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
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

        {submitError ? (
          <p className="text-sm text-destructive">{submitError}</p>
        ) : null}
      </div>

      <div className="border-t border-border px-3 pb-4 pt-2.5">
        <button
          type="button"
          disabled={!isValid || submitting}
          onClick={() => void handleConfirm()}
          className={cn(
            pageCtaBaseClass,
            'gap-2 text-white',
            isValid && !submitting ? 'bg-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          {submitting ? <Loader2 className="size-5 animate-spin" /> : null}
          {submitting ? 'Reagendando…' : 'Confirmar novo horário'}
        </button>
      </div>
    </div>
  );
}

export default function ReagendarPedidoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </div>
      }
    >
      <ReagendarPedidoContent />
    </Suspense>
  );
}
