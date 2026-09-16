'use client';

import { ImagePlus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Props = {
  previewImageUrl: string | null;
  busy: boolean;
  onAddFile: (file: File) => void;
  onDelete: () => void;
};

/**
 * Campo de imagem de preview de um sabor de pizza — só aparece quando o
 * produto é `productType === 'pizza_flavor'`. Diferente de
 * `ProductImagesManager` (galeria com várias fotos), aqui é 1 imagem só: a
 * foto do recheio SEM borda, que o client sobrepõe com a massa via CSS no
 * construtor de pizza. Usar a foto normal do produto aqui costuma conflitar
 * com a borda (fundo, enquadramento diferente).
 */
export function ProductPreviewImageField({
  previewImageUrl,
  busy,
  onAddFile,
  onDelete,
}: Props) {
  return (
    <div className="space-y-2 border-b border-border p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold">Imagem de preview</p>
          <p className="text-2xs text-muted-foreground">
            Só o recheio, sem borda — a massa é adicionada por cima no
            construtor de pizza. Proporção recomendada: 1:1.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-full bg-muted">
          {previewImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewImageUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-2xs text-muted-foreground">
              Sem foto
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-2xs font-semibold transition-colors hover:bg-accent',
              busy && 'pointer-events-none opacity-60',
            )}
          >
            <ImagePlus className="size-3.5" />
            {previewImageUrl ? 'Trocar' : 'Adicionar'}
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

          {previewImageUrl ? (
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-2xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-30"
            >
              <Trash2 className="size-3.5" />
              Remover
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
