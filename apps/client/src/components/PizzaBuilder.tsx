'use client';

import { X } from 'lucide-react';
import {
  PizzaBuilderFooter,
  PizzaCrustNotice,
  PizzaModeSwitch,
  PizzaSizePicker,
} from '@/components/PizzaBuilderControls';
import { PizzaPreview } from '@/components/PizzaPreview';
import { PizzaSlotModal } from '@/components/PizzaSlotModal';
import { PizzaSummary } from '@/components/PizzaSummary';
import { Textarea } from '@/components/ui/textarea';
import { useBodyScrollLock } from '@/lib/use-body-scroll-lock';
import { usePizzaBuilder } from '@/lib/use-pizza-builder';
import { cn } from '@/lib/utils';
import type {
  CatalogPizzaAddon,
  CatalogPizzaSize,
  CatalogProduct,
} from '@/modules/catalog/types';

type Props = {
  open: boolean;
  onClose: () => void;
  flavors: CatalogProduct[];
  sizes: CatalogPizzaSize[];
  addons: CatalogPizzaAddon[];
};

export default function PizzaBuilder({
  open,
  onClose,
  flavors,
  sizes,
  addons,
}: Props) {
  const builder = usePizzaBuilder({ flavors, sizes, addons, onDone: onClose });
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-foreground/25"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pizza-builder-title"
        className={cn(
          'relative z-10 flex max-h-[88dvh] w-full max-w-lg flex-col',
          'rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl',
        )}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
          <h2
            id="pizza-builder-title"
            className="flex-1 font-serif text-lg font-semibold"
          >
            Monte sua pizza
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
          <PizzaSizePicker
            sizes={sizes}
            sizeId={builder.sizeId}
            onSelect={builder.setSizeId}
          />

          <section>
            <PizzaModeSwitch mode={builder.mode} onChange={builder.setMode} />
            <PizzaPreview
              mode={builder.mode}
              flavor1={builder.flavor1}
              flavor2={builder.flavor2}
              onEditSlot={builder.openSlot}
              sizeLabel={
                builder.size
                  ? `${builder.size.name} · ${builder.size.diameterCm}cm`
                  : undefined
              }
            />
          </section>

          <PizzaSummary lines={builder.summaryLines} />

          <PizzaCrustNotice />

          <section>
            <h3 className="mb-2 text-sm font-semibold">
              Observação{' '}
              <span className="text-xs font-normal text-muted-foreground">
                (opcional)
              </span>
            </h3>
            <Textarea
              value={builder.note}
              onChange={(e) => builder.setNote(e.target.value.slice(0, 180))}
              placeholder="Ex.: massa bem assada, sem cebola…"
              rows={2}
              className="min-h-[64px] w-full resize-none text-sm"
            />
          </section>
        </div>

        <PizzaBuilderFooter
          quantity={builder.quantity}
          onQuantityChange={builder.setQuantity}
          canAdd={builder.canAdd}
          totalCents={builder.totalCents}
          disabledLabel={
            builder.mode === 2 ? 'Escolha os 2 sabores' : 'Escolha o sabor'
          }
          onAdd={builder.handleAdd}
        />
      </div>

      <PizzaSlotModal
        key={builder.modalKey}
        open={builder.activeSlot !== null}
        title={
          builder.mode === 1
            ? 'Sabor da pizza'
            : builder.activeSlot === 'flavor2'
              ? 'Sabor 2'
              : 'Sabor 1'
        }
        flavors={flavors}
        sizeId={builder.sizeId}
        selectedFlavorId={
          builder.activeSlot
            ? builder.slots[builder.activeSlot].flavorId
            : undefined
        }
        onSelectFlavor={(flavorId) => {
          if (builder.activeSlot)
            builder.selectFlavorForSlot(builder.activeSlot, flavorId);
        }}
        addons={addons}
        selectedAddonIds={
          builder.activeSlot ? builder.slots[builder.activeSlot].addonIds : []
        }
        onToggleAddon={(addonId) => {
          if (builder.activeSlot)
            builder.toggleAddonForSlot(builder.activeSlot, addonId);
        }}
        onClearAddons={() => {
          if (builder.activeSlot)
            builder.clearAddonsForSlot(builder.activeSlot);
        }}
        priceForAddon={builder.addonPriceForSlot}
        onClose={builder.closeSlot}
      />
    </div>
  );
}
