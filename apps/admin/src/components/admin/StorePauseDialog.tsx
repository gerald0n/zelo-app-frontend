'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

type Props = {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  /** `until` nulo = pausa sem previsão. */
  onConfirm: (until: string | null, reason: string | null) => void;
};

type Preset = { label: string; minutes: number | null };

const PRESETS: Preset[] = [
  { label: '30 min', minutes: 30 },
  { label: '1 hora', minutes: 60 },
  { label: '2 horas', minutes: 120 },
  { label: '4 horas', minutes: 240 },
  { label: 'Até amanhã 8h', minutes: -1 },
  { label: 'Sem previsão', minutes: null },
];

function untilFor(preset: Preset): string | null {
  if (preset.minutes === null) return null;
  if (preset.minutes === -1) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d.toISOString();
  }
  return new Date(Date.now() + preset.minutes * 60_000).toISOString();
}

/** Diálogo de pausar a loja: escolhe a duração (presets) e um motivo opcional. */
export function StorePauseDialog({ open, busy, onCancel, onConfirm }: Props) {
  const [selected, setSelected] = useState(0);
  const [reason, setReason] = useState('');

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-3 sm:items-center"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pausar a loja"
        className="relative w-full max-w-sm space-y-3 rounded-xl border border-border bg-card p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="Fechar"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent"
        >
          <X className="size-4" />
        </button>

        <p className="text-sm font-bold">Pausar a loja</p>
        <p className="text-2xs text-muted-foreground">
          Clientes não conseguem finalizar novos pedidos enquanto estiver
          pausada. Com prazo, a loja volta sozinha no horário.
        </p>

        <div className="grid grid-cols-3 gap-1.5">
          {PRESETS.map((preset, index) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setSelected(index)}
              className={cn(
                'rounded-md border px-2 py-2 text-2xs font-semibold transition-colors',
                selected === index
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-accent',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <label className="block text-2xs font-semibold text-muted-foreground">
          Motivo (opcional)
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={280}
            placeholder="Ex.: fila cheia, forno em manutenção…"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm text-foreground"
          />
        </label>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onConfirm(untilFor(PRESETS[selected]), reason.trim() || null)
            }
            className="flex-1 rounded-md bg-destructive py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Pausando…' : 'Pausar loja'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
