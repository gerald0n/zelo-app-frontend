'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { ProductFormCard } from '@/app/admin/catalogo/_tabs/ProductFormCard';
import type { ProductForm } from '@/app/admin/catalogo/catalog-forms';
import type { AdminAddon, AdminCategory } from '@/modules/admin/types';

type Props = {
  open: boolean;
  form: UseFormReturn<ProductForm>;
  editingProduct: boolean;
  categories: AdminCategory[];
  addons: AdminAddon[];
  isPending: boolean;
  onSubmit: (values: ProductForm) => void;
  onClose: () => void;
};

/** Formulário de produto num modal (antes era um card inline na lista). */
export function ProductFormModal({ open, onClose, ...formProps }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-5" />
        </button>
        <ProductFormCard {...formProps} onCancel={onClose} />
      </div>
    </div>,
    document.body,
  );
}
