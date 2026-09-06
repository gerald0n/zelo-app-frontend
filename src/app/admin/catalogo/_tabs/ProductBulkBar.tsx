'use client';

import { createPortal } from 'react-dom';
import { PauseCircle, PlayCircle, Trash2, X } from 'lucide-react';

type Props = {
  count: number;
  busy: boolean;
  onClear: () => void;
  onPause: () => void;
  onResume: () => void;
  onArchive: () => void;
};

/** Barra flutuante de ações em lote — aparece com produtos selecionados. */
export function ProductBulkBar({
  count,
  busy,
  onClear,
  onPause,
  onResume,
  onArchive,
}: Props) {
  if (count === 0) return null;

  return createPortal(
    <div className="fixed inset-x-0 bottom-4 z-[1000] flex justify-center px-4 lg:pl-60">
      <div className="flex flex-wrap items-center gap-2 rounded-full border border-border bg-foreground px-3 py-2 text-background shadow-xl">
        <span className="px-1 text-xs font-semibold">
          {count}{' '}
          {count === 1 ? 'produto selecionado' : 'produtos selecionados'}
        </span>
        <span className="h-4 w-px bg-background/25" />
        <button
          type="button"
          disabled={busy}
          onClick={onPause}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:bg-background/15 disabled:opacity-50"
        >
          <PauseCircle className="size-3.5" />
          Pausar vendas
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onResume}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:bg-background/15 disabled:opacity-50"
        >
          <PlayCircle className="size-3.5" />
          Reativar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onArchive}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-background/15 disabled:opacity-50"
        >
          <Trash2 className="size-3.5" />
          Excluir
        </button>
        <button
          type="button"
          onClick={onClear}
          aria-label="Limpar seleção"
          className="rounded-full p-1 transition-colors hover:bg-background/15"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
