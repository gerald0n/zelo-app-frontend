'use client';

import { ProductThumb } from '@/components/product-thumb';
import { formatCatalogPrice } from '@/modules/catalog/types';
import { cn } from '@/lib/utils';

type Props = {
  startingPriceCents: number;
  onOpen: () => void;
};

/** Ponto de entrada único do construtor de pizza — substitui a listagem de cada sabor como card avulso. */
export function PizzaEntryCard({ startingPriceCents, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-border bg-card p-2.5 text-left transition-colors duration-150 hover:border-foreground/15',
        'lg:h-full lg:flex-col lg:items-stretch lg:gap-0 lg:p-0',
      )}
    >
      <ProductThumb
        tone="salgado"
        src={null}
        alt="Monte sua pizza"
        className="size-20 shrink-0 rounded-lg lg:aspect-square lg:h-auto lg:w-full lg:rounded-none"
        iconClassName="size-9 lg:size-10"
      />
      <div className="min-w-0 flex-1 lg:p-2.5">
        <p className="truncate text-sm font-semibold">Monte sua pizza</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          Escolha até 2 sabores meio a meio e os adicionais
        </p>
        <p className="mt-1 text-sm font-semibold">
          A partir de {formatCatalogPrice(startingPriceCents)}
        </p>
      </div>
    </button>
  );
}
