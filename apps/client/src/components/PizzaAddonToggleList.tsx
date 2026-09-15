'use client';

import { Check } from 'lucide-react';
import {
  formatCatalogPrice,
  type CatalogPizzaAddon,
} from '@/modules/catalog/types';
import { cn } from '@/lib/utils';

type Props = {
  addons: CatalogPizzaAddon[];
  selectedAddonIds: string[];
  priceForAddon: (addon: CatalogPizzaAddon) => number;
  onToggle: (addonId: string) => void;
};

/** Seleção múltipla de adicionais para UM sabor/metade específica — sem noção de "pizza toda". */
export function PizzaAddonToggleList({
  addons,
  selectedAddonIds,
  priceForAddon,
  onToggle,
}: Props) {
  if (addons.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Sem adicionais disponíveis.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {addons.map((addon) => {
        const selected = selectedAddonIds.includes(addon.id);
        return (
          <button
            key={addon.id}
            type="button"
            onClick={() => onToggle(addon.id)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-[border-color,background-color] duration-100',
              selected
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card',
            )}
          >
            <span
              className={cn(
                'flex size-[22px] shrink-0 items-center justify-center rounded-md border-[1.5px]',
                selected
                  ? 'border-primary bg-primary'
                  : 'border-border bg-transparent',
              )}
            >
              {selected ? <Check className="size-3.5 text-white" /> : null}
            </span>
            <span className="flex-1 text-sm">{addon.name}</span>
            <span className="text-sm font-medium text-muted-foreground">
              {formatCatalogPrice(priceForAddon(addon))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
