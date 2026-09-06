'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SLOT_TIME_RE } from '@/app/admin/configuracoes/configuracoes-forms';

type Props = {
  slotTimes: string[];
  setSlotTimes: (updater: (prev: string[]) => string[]) => void;
  dirty: boolean;
  isPending: boolean;
  onSave: (times: string[]) => void;
};

export function SlotTimesSection({
  slotTimes,
  setSlotTimes,
  dirty,
  isPending,
  onSave,
}: Props) {
  const [slotDraft, setSlotDraft] = useState('');

  const addSlot = () => {
    if (!SLOT_TIME_RE.test(slotDraft)) return;
    setSlotTimes((prev) =>
      prev.includes(slotDraft)
        ? prev
        : [...prev, slotDraft].sort((a, b) => a.localeCompare(b)),
    );
    setSlotDraft('');
  };

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-3.5">
      <div>
        <p className="text-sm font-semibold">Horários de agendamento</p>
        <p className="mt-0.5 text-2xs leading-4 text-muted-foreground">
          Opções que o cliente vê ao escolher “Agendar” no checkout. Cada
          horário só aparece se couber na janela de funcionamento do dia e fora
          de períodos bloqueados.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {slotTimes.map((time) => (
          <span
            key={time}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 py-1 pl-2.5 pr-1 text-xs font-semibold tabular-nums"
          >
            {time}
            <button
              type="button"
              onClick={() =>
                setSlotTimes((prev) => prev.filter((t) => t !== time))
              }
              aria-label={`Remover ${time}`}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </button>
          </span>
        ))}
        {slotTimes.length === 0 ? (
          <p className="text-2xs text-destructive">
            Adicione ao menos um horário.
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="time"
          value={slotDraft}
          onChange={(event) => setSlotDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addSlot();
            }
          }}
          className="h-8 w-32 rounded-md border border-border px-2 text-xs"
        />
        <button
          type="button"
          onClick={addSlot}
          disabled={!SLOT_TIME_RE.test(slotDraft)}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold transition-[background-color,transform] duration-100 hover:bg-muted active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
        >
          <Plus className="size-3.5" />
          Adicionar
        </button>
      </div>

      <button
        type="button"
        onClick={() => onSave(slotTimes)}
        disabled={isPending || slotTimes.length === 0 || !dirty}
        className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100 disabled:opacity-60"
      >
        {isPending ? 'Salvando…' : 'Salvar horários de agendamento'}
      </button>
    </section>
  );
}
