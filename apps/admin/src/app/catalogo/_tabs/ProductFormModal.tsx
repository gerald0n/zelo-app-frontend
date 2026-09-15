'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { UseFormReturn } from 'react-hook-form';
import { ProductFormCard } from '@/app/catalogo/_tabs/ProductFormCard';
import { ProductImagesManager } from '@/app/catalogo/_tabs/ProductImagesManager';
import { ProductPreviewImageField } from '@/app/catalogo/_tabs/ProductPreviewImageField';
import type { ProductForm } from '@/app/catalogo/catalog-forms';
import type {
  AdminAddon,
  AdminCategory,
  AdminPizzaSize,
  AdminProduct,
} from '@/modules/admin/types';

type ImageMutation = UseMutationResult<
  unknown,
  unknown,
  { productId: string; imageId: string },
  unknown
>;

type ReorderMutation = UseMutationResult<
  unknown,
  unknown,
  { productId: string; orderedIds: string[] },
  unknown
>;

type Props = {
  open: boolean;
  form: UseFormReturn<ProductForm>;
  /** Produto sendo editado, ou `null` para um produto novo. */
  product: AdminProduct | null;
  categories: AdminCategory[];
  addons: AdminAddon[];
  satelliteLocations: Array<{ id: string; slug: string; name: string }>;
  pizzaSizes: AdminPizzaSize[];
  isPending: boolean;
  uploadPending: boolean;
  onSubmit: (values: ProductForm) => void;
  onAddImage: (file: File) => void;
  setPrimaryImage: ImageMutation;
  reorderImages: ReorderMutation;
  deleteImage: ImageMutation;
  previewUploadPending: boolean;
  onAddPreviewImage: (file: File) => void;
  onDeletePreviewImage: () => void;
  onClose: () => void;
};

/** Formulário de produto num modal (antes era um card inline na lista). */
export function ProductFormModal({
  open,
  form,
  product,
  categories,
  addons,
  satelliteLocations,
  pizzaSizes,
  isPending,
  uploadPending,
  onSubmit,
  onAddImage,
  setPrimaryImage,
  reorderImages,
  deleteImage,
  previewUploadPending,
  onAddPreviewImage,
  onDeletePreviewImage,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const imagesBusy =
    uploadPending ||
    setPrimaryImage.isPending ||
    reorderImages.isPending ||
    deleteImage.isPending;

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
        {product ? (
          <ProductImagesManager
            images={product.images}
            busy={imagesBusy}
            onAddFile={onAddImage}
            onSetPrimary={(imageId) =>
              setPrimaryImage.mutate({ productId: product.id, imageId })
            }
            onDelete={(imageId) =>
              deleteImage.mutate({ productId: product.id, imageId })
            }
            onReorder={(orderedIds) =>
              reorderImages.mutate({ productId: product.id, orderedIds })
            }
          />
        ) : null}
        {product && product.productType === 'pizza_flavor' ? (
          <ProductPreviewImageField
            previewImageUrl={product.previewImageUrl}
            busy={previewUploadPending}
            onAddFile={onAddPreviewImage}
            onDelete={onDeletePreviewImage}
          />
        ) : null}
        <ProductFormCard
          form={form}
          editingProduct={product !== null}
          categories={categories}
          addons={addons}
          satelliteLocations={satelliteLocations}
          pizzaSizes={pizzaSizes}
          isPending={isPending}
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}
