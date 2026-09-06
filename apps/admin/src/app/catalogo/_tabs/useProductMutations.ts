'use client';

import { useMutation } from '@tanstack/react-query';
import { ApiError, apiJson } from '@/lib/api';
import {
  reaisToCents,
  type ProductForm,
} from '@/app/admin/catalogo/catalog-forms';
import type { AdminProduct } from '@/modules/admin/types';

type Options = {
  editingProduct: AdminProduct | null;
  invalidateCatalog: () => Promise<void>;
  onError: (message: string) => void;
  onProductSaved: () => void;
  onBulkDone: () => void;
};

/** Mutations do catálogo de produtos: salvar, alternar campo, lote e upload. */
export function useProductMutations({
  editingProduct,
  invalidateCatalog,
  onError,
  onProductSaved,
  onBulkDone,
}: Options) {
  const productMutation = useMutation({
    mutationFn: async (values: ProductForm) => {
      const payload = {
        categoryId: values.categoryId,
        name: values.name,
        description: values.description || null,
        priceCents: reaisToCents(values.priceReais),
        sortOrder: values.sortOrder,
        isActive: values.isActive,
        isAvailable: values.isAvailable,
        weightMinGrams: values.weightMinGrams
          ? Number(values.weightMinGrams)
          : null,
        weightMaxGrams: values.weightMaxGrams
          ? Number(values.weightMaxGrams)
          : null,
        stockQuantity: values.stockQuantity
          ? Number(values.stockQuantity)
          : null,
        addonIds: values.addonIds,
      };
      if (editingProduct) {
        return apiJson(`/api/v1/admin/products/${editingProduct.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      return apiJson('/api/v1/admin/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      onError('');
      onProductSaved();
      await invalidateCatalog();
    },
    onError: (error) => {
      onError(
        error instanceof ApiError ? error.message : 'Falha ao salvar produto.',
      );
    },
  });

  const patchMutation = useMutation({
    mutationFn: (input: { id: string; body: Record<string, unknown> }) =>
      apiJson(`/api/v1/admin/products/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify(input.body),
      }),
    onSuccess: invalidateCatalog,
    onError: (error) => {
      onError(error instanceof ApiError ? error.message : 'Falha na operação.');
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (input: {
      ids: string[];
      body: Record<string, unknown>;
    }) => {
      await Promise.all(
        input.ids.map((id) =>
          apiJson(`/api/v1/admin/products/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(input.body),
          }),
        ),
      );
    },
    onSuccess: async () => {
      onError('');
      onBulkDone();
      await invalidateCatalog();
    },
    onError: (error) => {
      onError(error instanceof ApiError ? error.message : 'Falha em lote.');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (input: { productId: string; file: File }) => {
      const form = new FormData();
      form.set('productId', input.productId);
      form.set('file', input.file);
      form.set('altText', input.file.name);
      form.set('isPrimary', 'true');
      return apiJson('/api/v1/admin/uploads/product-image', {
        method: 'POST',
        body: form,
      });
    },
    onSuccess: invalidateCatalog,
    onError: (error) => {
      onError(error instanceof ApiError ? error.message : 'Falha no upload.');
    },
  });

  return { productMutation, patchMutation, bulkMutation, uploadMutation };
}
