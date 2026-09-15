'use client';

import { Minus, Plus, Wheat } from 'lucide-react';
import {
  formatCatalogPrice,
  type CatalogPizzaSize,
} from '@/modules/catalog/types';
import { cn } from '@/lib/utils';

/** Grade de tamanhos — só renderiza algo quando há mais de 1 tamanho ativo. */
export function PizzaSizePicker({
  sizes,
  sizeId,
  onSelect,
}: {
  sizes: CatalogPizzaSize[];
  sizeId: string | undefined;
  onSelect: (sizeId: string) => void;
}) {
  if (sizes.length <= 1) return null;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Tamanho</h3>
      <div className="grid grid-cols-3 gap-2">
        {sizes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={cn(
              'rounded-xl border p-3 text-center transition-colors duration-100',
              sizeId === s.id
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card',
            )}
          >
            <p className="text-base font-semibold">{s.name}</p>
            <p className="text-xs text-muted-foreground">{s.diameterCm}cm</p>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Alterna entre 1 sabor (pizza inteira) e 2 sabores (meio a meio). */
export function PizzaModeSwitch({
  mode,
  onChange,
}: {
  mode: 1 | 2;
  onChange: (mode: 1 | 2) => void;
}) {
  return (
    <div className="mb-4 flex gap-2">
      <button
        type="button"
        onClick={() => onChange(1)}
        className={cn(
          'flex-1 rounded-xl border p-2.5 text-sm font-semibold transition-colors duration-100',
          mode === 1 ? 'border-primary bg-primary/10' : 'border-border bg-card',
        )}
      >
        1 sabor
      </button>
      <button
        type="button"
        onClick={() => onChange(2)}
        className={cn(
          'flex-1 rounded-xl border p-2.5 text-sm font-semibold transition-colors duration-100',
          mode === 2 ? 'border-primary bg-primary/10' : 'border-border bg-card',
        )}
      >
        Meio a meio (2 sabores)
      </button>
    </div>
  );
}

/** Aviso informativo (sem seleção real ainda) de que bordas recheadas estão chegando. */
export function PizzaCrustNotice() {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Borda</h3>
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <Wheat
            className="size-[18px] text-muted-foreground"
            strokeWidth={1.75}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Bordas recheadas</p>
          <p className="text-xs text-muted-foreground">
            Em breve você vai poder escolher a borda da sua pizza aqui.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-2xs font-semibold text-muted-foreground">
          Em breve
        </span>
      </div>
    </section>
  );
}

/** Rodapé fixo: quantidade + botão de adicionar com o preço total. */
export function PizzaBuilderFooter({
  quantity,
  onQuantityChange,
  canAdd,
  totalCents,
  disabledLabel,
  onAdd,
}: {
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  canAdd: boolean;
  totalCents: number;
  disabledLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 border-t border-border bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 sm:rounded-b-2xl">
      <div className="flex items-center overflow-hidden rounded-md border border-border">
        <button
          type="button"
          aria-label="Diminuir"
          className="p-2 transition-transform duration-100 active:scale-90"
          onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
        >
          <Minus className="size-5" />
        </button>
        <span className="px-3.5 text-base font-semibold tabular-nums">
          {quantity}
        </span>
        <button
          type="button"
          aria-label="Aumentar"
          className="p-2 transition-transform duration-100 active:scale-90"
          onClick={() => onQuantityChange(quantity + 1)}
        >
          <Plus className="size-5" />
        </button>
      </div>
      <button
        type="button"
        disabled={!canAdd}
        onClick={onAdd}
        className={cn(
          'flex-1 rounded-md py-2.5 text-center text-sm font-semibold tabular-nums transition-transform duration-100 active:scale-[0.99] disabled:active:scale-100',
          canAdd ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
        )}
      >
        {canAdd
          ? `Adicionar · ${formatCatalogPrice(totalCents)}`
          : disabledLabel}
      </button>
    </div>
  );
}
