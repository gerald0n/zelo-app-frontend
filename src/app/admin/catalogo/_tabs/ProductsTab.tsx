'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { ApiError, apiJson } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  centsToReais,
  productSchema,
  reaisToCents,
  type ProductForm,
} from '@/app/admin/catalogo/catalog-forms';
import { ProductFormCard } from '@/app/admin/catalogo/_tabs/ProductFormCard';
import { ProductListRow } from '@/app/admin/catalogo/_tabs/ProductListRow';
import type {
  AdminAddon,
  AdminCategory,
  AdminProduct,
} from '@/modules/admin/types';

type Props = {
  categories: AdminCategory[];
  products: AdminProduct[];
  addons: AdminAddon[];
  invalidateCatalog: () => Promise<void>;
  onError: (message: string) => void;
};

export function ProductsTab({
  categories,
  products,
  addons,
  invalidateCatalog,
  onError,
}: Props) {
  const { confirm } = useAppDialog();
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(
    null,
  );
  const [showProductForm, setShowProductForm] = useState(false);

  const productForm = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      categoryId: '',
      name: '',
      description: '',
      priceReais: 0,
      sortOrder: 0,
      isActive: true,
      isAvailable: true,
      weightMinGrams: '',
      weightMaxGrams: '',
      stockQuantity: '',
      addonIds: [],
    },
  });

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
      setShowProductForm(false);
      setEditingProduct(null);
      onError('');
      productForm.reset({
        categoryId: categories[0]?.id ?? '',
        name: '',
        description: '',
        priceReais: 0,
        sortOrder: 0,
        isActive: true,
        isAvailable: true,
        weightMinGrams: '',
        weightMaxGrams: '',
        stockQuantity: '',
        addonIds: [],
      });
      await invalidateCatalog();
    },
    onError: (error) => {
      onError(
        error instanceof ApiError ? error.message : 'Falha ao salvar produto.',
      );
    },
  });

  const availabilityMutation = useMutation({
    mutationFn: (product: AdminProduct) =>
      apiJson(`/api/v1/admin/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable: !product.isAvailable }),
      }),
    onSuccess: invalidateCatalog,
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      apiJson(`/api/v1/admin/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archive: true }),
      }),
    onSuccess: invalidateCatalog,
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

  const visibleProducts = useMemo(
    () =>
      categoryFilter
        ? products.filter((product) => product.categoryId === categoryFilter)
        : products,
    [categoryFilter, products],
  );

  const openProductForm = (product?: AdminProduct) => {
    onError('');
    setEditingProduct(product ?? null);
    productForm.reset(
      product
        ? {
            categoryId: product.categoryId,
            name: product.name,
            description: product.description ?? '',
            priceReais: centsToReais(product.priceCents),
            sortOrder: product.sortOrder,
            isActive: product.isActive,
            isAvailable: product.isAvailable,
            weightMinGrams:
              product.weightMinGrams != null
                ? String(product.weightMinGrams)
                : '',
            weightMaxGrams:
              product.weightMaxGrams != null
                ? String(product.weightMaxGrams)
                : '',
            stockQuantity:
              product.stockQuantity != null
                ? String(product.stockQuantity)
                : '',
            addonIds: product.addonIds,
          }
        : {
            categoryId: categories[0]?.id ?? '',
            name: '',
            description: '',
            priceReais: 0,
            sortOrder: products.length,
            isActive: true,
            isAvailable: true,
            weightMinGrams: '',
            weightMaxGrams: '',
            stockQuantity: '',
            addonIds: [],
          },
    );
    setShowProductForm(true);
  };

  const confirmArchive = (product: AdminProduct) => {
    void (async () => {
      const ok = await confirm({
        title: 'Arquivar produto',
        description: `Arquivar ${product.name}?`,
        confirmLabel: 'Arquivar',
        tone: 'destructive',
      });
      if (!ok) return;
      archiveMutation.mutate(product.id);
    })();
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setCategoryFilter(null)}
            className={cn(
              'shrink-0 rounded-md border px-3 py-1.5 text-2xs font-semibold',
              categoryFilter === null
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-card',
            )}
          >
            Todos
          </button>
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategoryFilter(item.id)}
              className={cn(
                'shrink-0 rounded-md border px-3 py-1.5 text-2xs font-semibold',
                categoryFilter === item.id
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-card',
              )}
            >
              {item.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => openProductForm()}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100"
        >
          <Plus className="size-3.5" />
          Novo
        </button>
      </div>

      {showProductForm ? (
        <ProductFormCard
          form={productForm}
          editingProduct={editingProduct !== null}
          categories={categories}
          addons={addons}
          isPending={productMutation.isPending}
          onSubmit={(values) => productMutation.mutate(values)}
          onCancel={() => {
            setShowProductForm(false);
            setEditingProduct(null);
          }}
        />
      ) : null}

      <div className="space-y-2">
        {visibleProducts.map((product) => (
          <ProductListRow
            key={product.id}
            product={product}
            onEdit={openProductForm}
            onArchive={confirmArchive}
            onToggleAvailability={(item) => availabilityMutation.mutate(item)}
            onUpload={(item, file) =>
              uploadMutation.mutate({ productId: item.id, file })
            }
          />
        ))}
        {visibleProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto.</p>
        ) : null}
      </div>
    </section>
  );
}
