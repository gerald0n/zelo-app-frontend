'use client';

import {
  Check,
  Copy,
  Pencil,
  Trash2,
  Upload,
  UtensilsCrossed,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type { AdminProduct } from '@/modules/admin/types';

type Props = {
  product: AdminProduct;
  selected: boolean;
  onToggleSelect: (product: AdminProduct) => void;
  onEdit: (product: AdminProduct) => void;
  onArchive: (product: AdminProduct) => void;
  onDuplicate: (product: AdminProduct) => void;
  onToggleAvailability: (product: AdminProduct) => void;
  onUpload: (product: AdminProduct, file: File) => void;
};

function statusBadge(product: AdminProduct) {
  if (product.stockQuantity === 0) {
    return { label: 'Esgotado', className: 'bg-destructive text-white' };
  }
  if (product.stockQuantity != null && product.stockQuantity <= 5) {
    return {
      label: 'Estoque baixo',
      className: 'bg-tone-warning text-tone-warning-foreground',
    };
  }
  if (!product.isAvailable) {
    return {
      label: 'Pausado',
      className: 'bg-tone-neutral text-tone-neutral-foreground',
    };
  }
  return {
    label: 'Ativo',
    className: 'bg-tone-positive text-tone-positive-foreground',
  };
}

export function ProductGridCard({
  product,
  selected,
  onToggleSelect,
  onEdit,
  onArchive,
  onDuplicate,
  onToggleAvailability,
  onUpload,
}: Props) {
  const badge = statusBadge(product);
  const stock = product.stockQuantity;

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border bg-card transition-colors',
        selected ? 'border-primary ring-1 ring-primary' : 'border-border',
      )}
    >
      <div className="relative aspect-square bg-muted">
        {product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.images[0].url}
            alt={product.images[0].altText}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <UtensilsCrossed className="size-6 text-muted-foreground" />
          </div>
        )}
        <span
          className={cn(
            'absolute left-2 top-2 rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wide',
            badge.className,
          )}
        >
          {badge.label}
        </span>
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label="Selecionar produto"
          onClick={() => onToggleSelect(product)}
          className={cn(
            'absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border transition-colors',
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card/90 text-transparent hover:text-muted-foreground',
          )}
        >
          <Check className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          {product.categoryName}
        </p>
        <p className="font-serif text-sm font-bold leading-tight">
          {product.name}
        </p>
        {product.description ? (
          <p className="line-clamp-2 text-2xs text-muted-foreground">
            {product.description}
          </p>
        ) : null}

        <p className="mt-1 flex items-center gap-1.5 text-2xs font-medium">
          <span
            className={cn(
              'size-1.5 rounded-full',
              stock === 0
                ? 'bg-destructive'
                : stock != null && stock <= 5
                  ? 'bg-tone-warning-foreground'
                  : 'bg-success',
            )}
          />
          {stock != null
            ? stock === 0
              ? 'Sem unidades'
              : `${stock} unidades prontas`
            : 'Sob demanda'}
        </p>

        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <p className="text-2xs text-muted-foreground">Preço unitário</p>
            <p className="font-serif text-base font-bold">
              {formatCatalogPrice(product.priceCents)}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={product.isAvailable}
            aria-label="Disponível para venda"
            onClick={() => onToggleAvailability(product)}
            className={cn(
              'relative h-6 w-11 shrink-0 rounded-full transition-colors',
              product.isAvailable ? 'bg-primary' : 'bg-muted',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 size-5 rounded-full bg-white transition-transform',
                product.isAvailable ? 'left-5' : 'left-0.5',
              )}
            />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-t border-border p-2">
        <button
          type="button"
          onClick={() => onEdit(product)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border py-1.5 text-2xs font-semibold transition-colors hover:bg-accent"
        >
          <Pencil className="size-3" />
          Editar
        </button>
        <label className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent">
          <Upload className="size-3" />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              onUpload(product, file);
              event.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => onDuplicate(product)}
          aria-label="Duplicar produto"
          className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent"
        >
          <Copy className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => onArchive(product)}
          aria-label="Arquivar produto"
          className="flex size-7 items-center justify-center rounded-md border border-border text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  );
}
