'use client';

import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Star,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { AdminProductImage } from '@/modules/admin/types';

type Props = {
  images: AdminProductImage[];
  busy: boolean;
  onAddFile: (file: File) => void;
  onSetPrimary: (imageId: string) => void;
  onDelete: (imageId: string) => void;
  onReorder: (orderedIds: string[]) => void;
};

/**
 * Galeria de fotos de um produto, dentro do modal de edição. A ordem é a que
 * aparece no `images` (já vem com a principal primeiro, depois por `sortOrder`).
 * Reordenar é por setas ← →, coerente com a decisão de não usar arraste no
 * catálogo.
 */
export function ProductImagesManager({
  images,
  busy,
  onAddFile,
  onSetPrimary,
  onDelete,
  onReorder,
}: Props) {
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = images.map((image) => image.id);
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next);
  };

  return (
    <div className="space-y-2 border-b border-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">
          Fotos{' '}
          <span className="font-normal text-muted-foreground">
            ({images.length})
          </span>
        </p>
        <label
          className={cn(
            'inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-2xs font-semibold transition-colors hover:bg-accent',
            busy && 'pointer-events-none opacity-60',
          )}
        >
          <ImagePlus className="size-3.5" />
          Adicionar
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              onAddFile(file);
              event.target.value = '';
            }}
          />
        </label>
      </div>

      {images.length === 0 ? (
        <p className="rounded-md border border-dashed border-border py-6 text-center text-2xs text-muted-foreground">
          Nenhuma foto ainda.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((image, index) => (
            <li
              key={image.id}
              className={cn(
                'flex flex-col gap-1 rounded-lg border p-1',
                image.isPrimary ? 'border-primary' : 'border-border',
              )}
            >
              <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.altText}
                  className="absolute inset-0 size-full object-cover"
                />
                {image.isPrimary ? (
                  <span className="absolute left-1 top-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                    Principal
                  </span>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-0.5">
                <button
                  type="button"
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Mover para a esquerda"
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busy || image.isPrimary}
                  onClick={() => onSetPrimary(image.id)}
                  aria-label="Definir como principal"
                  className={cn(
                    'rounded p-1 transition-colors hover:bg-accent disabled:opacity-30',
                    image.isPrimary ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <Star
                    className={cn(
                      'size-3.5',
                      image.isPrimary && 'fill-current',
                    )}
                  />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDelete(image.id)}
                  aria-label="Remover foto"
                  className="rounded p-1 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-30"
                >
                  <Trash2 className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busy || index === images.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="Mover para a direita"
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
