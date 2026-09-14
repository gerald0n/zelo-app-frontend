'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { WEEKDAY_LABELS } from '@/lib/constants';

export type SlotDraft = { startsAt: string; endsAt: string; label: string };

type Props = {
  weekday: number;
  initialSlots: SlotDraft[];
  isPending: boolean;
  onSave: (
    slots: Array<{ startsAt: string; endsAt: string | null; label: string | null }>,
  ) => void;
};

/**
 * Editor de slots fixos de um dia. Sem `useEffect` pra ressincronizar: o pai
 * troca a `key` (via `SatelliteLocationSection`) sempre que os slots salvos
 * no servidor mudam, o que remonta este componente e reseta o estado local
 * pelo valor inicial do `useState` — mais simples que sincronizar em efeito.
 */
export function SatelliteDeliverySlotsEditor({
  weekday,
  initialSlots,
  isPending,
  onSave,
}: Props) {
  const [slots, setSlots] = useState(initialSlots);

  return (
    <div className="space-y-2 rounded-md border border-border p-2.5">
      <p className="text-xs font-semibold">{WEEKDAY_LABELS[weekday]}</p>
      {slots.map((slot, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <Input
            type="time"
            value={slot.startsAt}
            onChange={(event) =>
              setSlots((current) =>
                current.map((item, i) =>
                  i === index ? { ...item, startsAt: event.target.value } : item,
                ),
              )
            }
            className="h-8 w-24 rounded-md border border-border px-2 text-xs"
          />
          <Input
            type="time"
            placeholder="fim (opcional)"
            value={slot.endsAt}
            onChange={(event) =>
              setSlots((current) =>
                current.map((item, i) =>
                  i === index ? { ...item, endsAt: event.target.value } : item,
                ),
              )
            }
            className="h-8 w-24 rounded-md border border-border px-2 text-xs"
          />
          <Input
            type="text"
            placeholder="rótulo (opcional)"
            value={slot.label}
            onChange={(event) =>
              setSlots((current) =>
                current.map((item, i) =>
                  i === index ? { ...item, label: event.target.value } : item,
                ),
              )
            }
            className="h-8 w-40 rounded-md border border-border px-2 text-xs"
          />
          <button
            type="button"
            onClick={() =>
              setSlots((current) => current.filter((_, i) => i !== index))
            }
            className="text-2xs font-semibold text-destructive"
          >
            Remover
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setSlots((current) => [
              ...current,
              { startsAt: '12:00', endsAt: '', label: '' },
            ])
          }
          className="rounded-md border border-border px-2.5 py-1 text-2xs font-semibold"
        >
          + Horário
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            onSave(
              slots.map((slot) => ({
                startsAt: slot.startsAt,
                endsAt: slot.endsAt || null,
                label: slot.label || null,
              })),
            )
          }
          className="rounded-md bg-primary px-2.5 py-1 text-2xs font-semibold text-white disabled:opacity-60"
        >
          {isPending ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
