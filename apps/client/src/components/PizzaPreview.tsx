'use client';

import { Plus } from 'lucide-react';
import type { CatalogProduct } from '@/modules/catalog/types';
import { cn } from '@/lib/utils';

type Props = {
  mode: 1 | 2;
  flavor1: CatalogProduct | undefined;
  flavor2: CatalogProduct | undefined;
  onEditSlot: (slot: 'flavor1' | 'flavor2') => void;
  sizeLabel?: string;
  className?: string;
};

/**
 * Prévia visual da pizza — inteira ou meio a meio — e também a forma de abrir
 * o sabor de cada metade.
 *
 * A borda é a foto real da massa assada (`/pizza/crust-ring.png`, PNG com
 * fundo transparente). Os sabores preenchem um círculo levemente MAIOR que o
 * furo da massa (`inset-[7.8%]` vs. o furo real da imagem em ~8.7%) e a
 * massa fica por cima (`z-10`) — a sobreposição garante zero gap entre massa
 * e recheio mesmo com arredondamento de subpixel, em vez de tentar acertar o
 * raio exato e arriscar uma fresta.
 */
export function PizzaPreview({
  mode,
  flavor1,
  flavor2,
  onEditSlot,
  sizeLabel,
  className,
}: Props) {
  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative aspect-square w-52 shrink-0 sm:w-56">
        <div className="absolute inset-[7.8%] overflow-hidden rounded-full bg-gradient-to-br from-caramel/30 to-caramel/10">
          {mode === 1 ? (
            <FlavorSlotButton
              flavor={flavor1}
              side="full"
              onClick={() => onEditSlot('flavor1')}
            />
          ) : (
            <>
              <FlavorSlotButton
                flavor={flavor1}
                side="left"
                onClick={() => onEditSlot('flavor1')}
              />
              <FlavorSlotButton
                flavor={flavor2}
                side="right"
                onClick={() => onEditSlot('flavor2')}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/70 mix-blend-overlay"
              />
            </>
          )}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/pizza/crust-ring.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute inset-0 z-10 size-full select-none object-contain"
        />
      </div>
      {sizeLabel ? (
        <p className="mt-2 text-2xs font-medium text-muted-foreground">
          {sizeLabel}
        </p>
      ) : null}
    </div>
  );
}

function FlavorSlotButton({
  flavor,
  side,
  onClick,
}: {
  flavor: CatalogProduct | undefined;
  side: 'left' | 'right' | 'full';
  onClick: () => void;
}) {
  const clipPath =
    side === 'left'
      ? 'polygon(0 0, 50% 0, 50% 100%, 0 100%)'
      : side === 'right'
        ? 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)'
        : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={flavor ? `Trocar sabor: ${flavor.name}` : 'Escolher sabor'}
      className="absolute inset-0 cursor-pointer"
      style={{ clipPath }}
    >
      {!flavor ? (
        <span className="relative flex size-full bg-muted/60 transition-colors duration-100 hover:bg-muted">
          <Plus
            className="absolute top-1/2 size-7 text-muted-foreground/70"
            strokeWidth={1.75}
            style={{
              left: side === 'left' ? '25%' : side === 'right' ? '75%' : '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        </span>
      ) : flavor.previewImage ?? flavor.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={flavor.id}
          src={flavor.previewImage ?? flavor.image ?? undefined}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center bg-pistachio/40 text-2xs font-medium text-pistachio-foreground/70">
          {flavor.name}
        </span>
      )}
    </button>
  );
}
