'use client';

import type { UseFormReturn } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  toLocalInputValue,
  type BlackoutForm,
} from '@/app/admin/configuracoes/configuracoes-forms';
import type { AdminBlackout } from '@/modules/admin/types';

type Props = {
  form: UseFormReturn<BlackoutForm>;
  blackouts: AdminBlackout[];
  onCreate: (values: BlackoutForm) => void;
  onDelete: (id: string) => void;
};

export function BlackoutsSection({
  form,
  blackouts,
  onCreate,
  onDelete,
}: Props) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-3.5">
      <p className="text-sm font-semibold">Períodos bloqueados</p>
      <form
        onSubmit={form.handleSubmit(onCreate)}
        className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <Input
          type="datetime-local"
          {...form.register('startsAt')}
          className="h-10 rounded-md border border-border px-3 text-sm"
        />
        <Input
          type="datetime-local"
          {...form.register('endsAt')}
          className="h-10 rounded-md border border-border px-3 text-sm"
        />
        <Input
          placeholder="Motivo"
          {...form.register('reason')}
          className="h-10 rounded-md border border-border px-3 text-sm"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100"
        >
          <Plus className="size-3.5" />
          Add
        </button>
      </form>
      <div className="space-y-2">
        {blackouts.map((blackout) => (
          <div
            key={blackout.id}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
          >
            <div className="min-w-0 flex-1 text-2xs text-muted-foreground">
              <p className="font-semibold text-foreground">
                {blackout.reason || 'Bloqueio'}
              </p>
              <p>
                {toLocalInputValue(blackout.startsAt).replace('T', ' ')} →{' '}
                {toLocalInputValue(blackout.endsAt).replace('T', ' ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(blackout.id)}
              className="rounded-md border border-border p-1.5 text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {blackouts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum período bloqueado.
          </p>
        ) : null}
      </div>
    </section>
  );
}
