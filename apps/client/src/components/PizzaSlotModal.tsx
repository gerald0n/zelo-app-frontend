'use client';

import { useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { PizzaAddonToggleList } from '@/components/PizzaAddonToggleList';
import { PizzaFlavorGrid } from '@/components/PizzaFlavorGrid';
import { flavorPriceCents, groupFlavorsByTier } from '@/lib/pizza';
import type {
  CatalogPizzaAddon,
  CatalogProduct,
} from '@/modules/catalog/types';
import { cn } from '@/lib/utils';

type Step = 'flavor' | 'addons';

type Props = {
  open: boolean;
  title: string;
  flavors: CatalogProduct[];
  sizeId: string | undefined;
  selectedFlavorId: string | undefined;
  onSelectFlavor: (flavorId: string) => void;
  addons: CatalogPizzaAddon[];
  selectedAddonIds: string[];
  onToggleAddon: (addonId: string) => void;
  onClearAddons: () => void;
  /** Preço do adicional aplicado a este sabor — metade ou pizza toda, decidido por quem chama. */
  priceForAddon: (addon: CatalogPizzaAddon) => number;
  onClose: () => void;
};

/** Modal de 2 passos (Sabor → Adicional) para escolher o conteúdo de UM sabor/metade da pizza. */
export function PizzaSlotModal({
  open,
  title,
  flavors,
  sizeId,
  selectedFlavorId,
  onSelectFlavor,
  addons,
  selectedAddonIds,
  onToggleAddon,
  onClearAddons,
  priceForAddon,
  onClose,
}: Props) {
  const [step, setStep] = useState<Step>('flavor');

  if (!open) return null;

  const { traditional, premium } = groupFlavorsByTier(flavors, sizeId);
  const hasAddons = addons.length > 0;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-foreground/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pizza-slot-modal-title"
        className="relative z-10 flex max-h-[85dvh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
          {step === 'addons' ? (
            <button
              type="button"
              onClick={() => setStep('flavor')}
              aria-label="Voltar"
              className="-ml-1.5 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft className="size-[18px]" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <h2
              id="pizza-slot-modal-title"
              className="font-serif text-lg font-semibold"
            >
              {step === 'flavor' ? 'Escolha o sabor' : 'Escolha os adicionais'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 px-4 pt-3">
          <div
            className={cn(
              'h-1 flex-1 rounded-full bg-primary transition-colors duration-150',
            )}
          />
          <div
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-150',
              step === 'addons' ? 'bg-primary' : 'bg-muted',
            )}
          />
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
          {step === 'flavor' ? (
            <>
              <PizzaFlavorGrid
                title="Tradicionais"
                flavors={traditional}
                selectedFlavorIds={selectedFlavorId ? [selectedFlavorId] : []}
                sizeId={sizeId}
                priceAtSize={(flavor) =>
                  sizeId ? flavorPriceCents(flavor, sizeId) : 0
                }
                onToggle={onSelectFlavor}
              />
              <PizzaFlavorGrid
                title="Premium"
                flavors={premium}
                selectedFlavorIds={selectedFlavorId ? [selectedFlavorId] : []}
                sizeId={sizeId}
                priceAtSize={(flavor) =>
                  sizeId ? flavorPriceCents(flavor, sizeId) : 0
                }
                onToggle={onSelectFlavor}
              />
            </>
          ) : (
            <PizzaAddonToggleList
              addons={addons}
              selectedAddonIds={selectedAddonIds}
              priceForAddon={priceForAddon}
              onToggle={onToggleAddon}
            />
          )}
        </div>

        <div className="flex gap-2.5 rounded-b-2xl border-t border-border bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
          {step === 'addons' ? (
            <button
              type="button"
              onClick={() => {
                onClearAddons();
                onClose();
              }}
              className="flex-1 rounded-md border border-border py-2.5 text-center text-sm font-semibold text-foreground transition-transform duration-100 active:scale-[0.99]"
            >
              Sem adicionais
            </button>
          ) : null}
          <button
            type="button"
            disabled={step === 'flavor' && !selectedFlavorId}
            onClick={() => {
              if (step === 'flavor' && hasAddons) {
                setStep('addons');
              } else {
                onClose();
              }
            }}
            className={cn(
              'flex-1 rounded-md py-2.5 text-center text-sm font-semibold transition-transform duration-100 active:scale-[0.99] disabled:active:scale-100',
              step === 'addons' || selectedFlavorId
                ? 'bg-primary text-white'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {step === 'flavor' && hasAddons
              ? 'Avançar · Adicional'
              : 'Concluir'}
          </button>
        </div>
      </div>
    </div>
  );
}
