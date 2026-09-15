'use client';

import { useWatch, type UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WEEKDAY_LABELS } from '@/lib/constants';
import type { SatelliteHourFormRow } from '@/app/configuracoes/useSatelliteLocation';

type HoursValues = { hours: SatelliteHourFormRow[] };

type Props = {
  form: UseFormReturn<HoursValues>;
  isPending: boolean;
  onSubmit: (values: HoursValues) => void;
};

export function SatelliteLocationHoursForm({ form, isPending, onSubmit }: Props) {
  const hours = useWatch({ control: form.control, name: 'hours' }) ?? [];

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-3 rounded-lg border border-border bg-card p-3.5"
    >
      <p className="text-sm font-semibold">
        Dias e janela de retirada (qua-sex, sem grade de horários)
      </p>
      <div className="space-y-2">
        {hours.map((hour, index) => (
          <div
            key={hour.weekday}
            className="grid gap-2 rounded-md border border-border p-2.5 sm:grid-cols-[1fr_auto_auto_auto_auto]"
          >
            <p className="text-xs font-semibold">
              {WEEKDAY_LABELS[hour.weekday]}
            </p>
            <Label className="inline-flex items-center gap-1.5 text-2xs">
              <input
                type="checkbox"
                checked={hour.isClosed}
                onChange={(event) =>
                  form.setValue(
                    `hours.${index}.isClosed`,
                    event.target.checked,
                  )
                }
              />
              Fechado
            </Label>
            <Input
              type="time"
              disabled={hour.isClosed}
              value={hour.pickupOpensAt}
              onChange={(event) =>
                form.setValue(
                  `hours.${index}.pickupOpensAt`,
                  event.target.value,
                )
              }
              className="h-8 rounded-md border border-border px-2 text-xs disabled:opacity-50"
            />
            <Input
              type="time"
              disabled={hour.isClosed}
              value={hour.pickupClosesAt}
              onChange={(event) =>
                form.setValue(
                  `hours.${index}.pickupClosesAt`,
                  event.target.value,
                )
              }
              className="h-8 rounded-md border border-border px-2 text-xs disabled:opacity-50"
            />
            <Label className="inline-flex items-center gap-1.5 text-2xs">
              <input
                type="checkbox"
                disabled={hour.isClosed}
                checked={hour.deliveryEnabled}
                onChange={(event) =>
                  form.setValue(
                    `hours.${index}.deliveryEnabled`,
                    event.target.checked,
                  )
                }
              />
              Delivery
            </Label>
          </div>
        ))}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100 disabled:opacity-60"
      >
        {isPending ? 'Salvando…' : 'Salvar dias e janela'}
      </button>
    </form>
  );
}
