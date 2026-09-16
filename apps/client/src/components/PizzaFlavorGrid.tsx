'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { PizzaFlavorPhotoPreview } from '@/components/PizzaFlavorPhotoPreview';
import { ProductThumb } from '@/components/product-thumb';
import {
  formatCatalogPrice,
  type CatalogProduct,
} from '@/modules/catalog/types';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  flavors: CatalogProduct[];
  selectedFlavorIds: string[];
  sizeId: string | undefined;
  priceAtSize: (flavor: CatalogProduct) => number;
  onToggle: (flavorId: string) => void;
};

export function PizzaFlavorGrid({
  title,
  flavors,
  selectedFlavorIds,
  sizeId,
  priceAtSize,
  onToggle,
}: Props) {
  const [previewFlavor, setPreviewFlavor] = useState<CatalogProduct | null>(
    null,
  );

  if (flavors.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="grid grid-cols-1 gap-2.5">
        {flavors.map((flavor) => {
          const selected = selectedFlavorIds.includes(flavor.id);
          const disabled = !flavor.available || !sizeId;
          return (
            <div
              key={flavor.id}
              className={cn(
                'flex gap-2.5 overflow-hidden rounded-xl border p-2.5 transition-[border-color,background-color] duration-100',
                selected
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card',
                disabled && 'opacity-45',
              )}
            >
              <button
                type="button"
                disabled={!flavor.image}
                onClick={() => setPreviewFlavor(flavor)}
                aria-label={`Ver foto: ${flavor.name}`}
                className="shrink-0 disabled:pointer-events-none"
              >
                <ProductThumb
                  tone="salgado"
                  src={flavor.image}
                  alt={flavor.name}
                  className="size-20 rounded-lg"
                  iconClassName="size-8"
                />
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggle(flavor.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <p className="text-sm font-semibold">{flavor.name}</p>
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px]',
                      selected
                        ? 'border-primary bg-primary'
                        : 'border-border bg-transparent',
                    )}
                  >
                    {selected ? (
                      <Check className="size-3 text-white" />
                    ) : null}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-2xs text-muted-foreground">
                  {flavor.description}
                </p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {formatCatalogPrice(priceAtSize(flavor))}
                </p>
              </button>
            </div>
          );
        })}
      </div>

      {previewFlavor?.image ? (
        <PizzaFlavorPhotoPreview
          name={previewFlavor.name}
          image={previewFlavor.image}
          onClose={() => setPreviewFlavor(null)}
        />
      ) : null}
    </section>
  );
}
