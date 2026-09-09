'use client';

import {
  ChevronDown,
  ChevronUp,
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
  /** Mutação de disponibilidade/duplicar em voo — trava o switch e o duplicar. */
  pending: boolean;
  onEdit: (product: AdminProduct) => void;
  onArchive: (product: AdminProduct) => void;
  onDuplicate: (product: AdminProduct) => void;
  onToggleAvailability: (product: AdminProduct) => void;
  onUpload: (product: AdminProduct, file: File) => void;
  /** Passado só quando a ordenação "Manual" está ativa. */
  reorder?: {
    onMoveUp: () => void;
    onMoveDown: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
  };
};

export function ProductListRow({
  product,
  pending,
  onEdit,
  onArchive,
  onDuplicate,
  onToggleAvailability,
  onUpload,
  reorder,
}: Props) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      {reorder ? (
        <div className="flex shrink-0 flex-col">
          <button
            type="button"
            onClick={reorder.onMoveUp}
            disabled={!reorder.canMoveUp}
            aria-label="Mover para cima"
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={reorder.onMoveDown}
            disabled={!reorder.canMoveDown}
            aria-label="Mover para baixo"
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
      ) : null}
      <span className="flex size-10 items-center justify-center overflow-hidden rounded-md bg-muted">
        {product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.images[0].url}
            alt={product.images[0].altText}
            className="size-full object-cover"
          />
        ) : (
          <UtensilsCrossed className="size-4 text-muted-foreground" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{product.name}</p>
        <p className="text-2xs text-muted-foreground">
          {product.categoryName} · {formatCatalogPrice(product.priceCents)}
          {product.stockQuantity != null ? (
            <>
              {' · '}
              <span
                className={cn(
                  'font-semibold',
                  product.stockQuantity === 0
                    ? 'text-destructive'
                    : product.stockQuantity <= 5
                      ? 'text-tone-warning'
                      : undefined,
                )}
              >
                {product.stockQuantity === 0
                  ? 'Esgotado'
                  : `${product.stockQuantity} em estoque`}
              </span>
            </>
          ) : null}
        </p>
      </div>
      <label className="cursor-pointer rounded-md border border-border p-1.5 text-muted-foreground">
        <Upload className="size-3.5" />
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
        onClick={() => onEdit(product)}
        className="rounded-md border border-border p-1.5 text-muted-foreground"
        aria-label="Editar produto"
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onDuplicate(product)}
        disabled={pending}
        className="rounded-md border border-border p-1.5 text-muted-foreground disabled:opacity-60"
        aria-label="Duplicar produto"
      >
        <Copy className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onArchive(product)}
        className="rounded-md border border-border p-1.5 text-destructive"
        aria-label="Arquivar produto"
      >
        <Trash2 className="size-3.5" />
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={product.isAvailable}
        disabled={pending}
        onClick={() => onToggleAvailability(product)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60',
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
  );
}
