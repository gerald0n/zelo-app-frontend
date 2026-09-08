'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAppDialog } from '@/contexts/AppDialogContext';
import {
  centsToReais,
  emptyProductForm,
  productSchema,
  type ProductForm,
} from '@/app/catalogo/catalog-forms';
import { ImageCropDialog } from '@/components/ImageCropDialog';
import { ProductCategoryFilter } from '@/app/catalogo/_tabs/ProductCategoryFilter';
import { ProductCollection } from '@/app/catalogo/_tabs/ProductCollection';
import { ProductFormModal } from '@/app/catalogo/_tabs/ProductFormModal';
import { ProductStats } from '@/app/catalogo/_tabs/ProductStats';
import { ProductBulkBar } from '@/app/catalogo/_tabs/ProductBulkBar';
import { useProductMutations } from '@/app/catalogo/_tabs/useProductMutations';
import {
  byManualOrder,
  reorderedProductIds,
} from '@/app/catalogo/_tabs/product-reorder';
import {
  ProductToolbar,
  type ProductSort,
  type ProductStatusFilter,
  type ProductView,
} from '@/app/catalogo/_tabs/ProductToolbar';
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

const SORTERS: Record<
  ProductSort,
  (a: AdminProduct, b: AdminProduct) => number
> = {
  manual: byManualOrder,
  name: (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
  'price-desc': (a, b) => b.priceCents - a.priceCents,
  'price-asc': (a, b) => a.priceCents - b.priceCents,
  'stock-asc': (a, b) =>
    (a.stockQuantity ?? Infinity) - (b.stockQuantity ?? Infinity),
};

function matchesStatus(product: AdminProduct, status: ProductStatusFilter) {
  if (status === 'available') return product.isAvailable;
  if (status === 'paused') return !product.isAvailable;
  if (status === 'low') {
    return product.stockQuantity != null && product.stockQuantity <= 5;
  }
  return true;
}

export function ProductsTab({
  categories,
  products,
  addons,
  invalidateCatalog,
  onError,
}: Props) {
  const { confirm } = useAppDialog();
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ProductStatusFilter>('all');
  const [sort, setSort] = useState<ProductSort>('name');
  const [view, setView] = useState<ProductView>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [cropTarget, setCropTarget] = useState<{
    productId: string;
    file: File;
  } | null>(null);

  const productForm = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: emptyProductForm(''),
  });

  // Deriva o produto em edição da lista atual (não guarda um snapshot) — assim a
  // galeria de fotos no modal reflete as mutações de imagem sem estado stale.
  const editingProduct = useMemo(
    () => products.find((product) => product.id === editingProductId) ?? null,
    [products, editingProductId],
  );

  const {
    productMutation,
    patchMutation,
    bulkMutation,
    duplicateMutation,
    reorderProductsMutation,
    uploadMutation,
    setPrimaryImageMutation,
    reorderImagesMutation,
    deleteImageMutation,
  } = useProductMutations({
    editingProduct,
    invalidateCatalog,
    onError,
    onProductSaved: () => {
      setShowProductForm(false);
      setEditingProductId(null);
      productForm.reset(emptyProductForm(categories[0]?.id ?? ''));
    },
    onBulkDone: () => setSelectedIds(new Set()),
  });

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products
      .filter((product) => {
        if (categoryFilter && product.categoryId !== categoryFilter)
          return false;
        if (!matchesStatus(product, status)) return false;
        if (!term) return true;
        return (
          product.name.toLowerCase().includes(term) ||
          product.categoryName.toLowerCase().includes(term) ||
          (product.description ?? '').toLowerCase().includes(term)
        );
      })
      .sort(SORTERS[sort]);
  }, [products, categoryFilter, status, query, sort]);

  const toggleSelect = (product: AdminProduct) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(product.id)) next.delete(product.id);
      else next.add(product.id);
      return next;
    });
  };

  const moveProduct = (product: AdminProduct, direction: -1 | 1) => {
    const ids = reorderedProductIds(
      products,
      visibleProducts,
      product.id,
      direction,
    );
    if (ids) reorderProductsMutation.mutate(ids);
  };

  const openProductForm = (product?: AdminProduct) => {
    onError('');
    setEditingProductId(product?.id ?? null);
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
        : emptyProductForm(categories[0]?.id ?? '', products.length),
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
      patchMutation.mutate({ id: product.id, body: { archive: true } });
    })();
  };

  const bulkArchive = () => {
    void (async () => {
      const ids = [...selectedIds];
      const ok = await confirm({
        title: 'Arquivar produtos',
        description: `Arquivar ${ids.length} ${ids.length === 1 ? 'produto' : 'produtos'}?`,
        confirmLabel: 'Arquivar',
        tone: 'destructive',
      });
      if (!ok) return;
      bulkMutation.mutate({ ids, body: { archive: true } });
    })();
  };

  return (
    <section className="space-y-3">
      <ProductStats products={products} categories={categories} />

      <ProductToolbar
        query={query}
        onQuery={setQuery}
        status={status}
        onStatus={setStatus}
        sort={sort}
        onSort={setSort}
        view={view}
        onView={setView}
        onNew={() => openProductForm()}
      />

      <ProductCategoryFilter
        categories={categories}
        products={products}
        value={categoryFilter}
        onChange={setCategoryFilter}
      />

      <ProductFormModal
        open={showProductForm}
        form={productForm}
        product={editingProduct}
        categories={categories}
        addons={addons}
        isPending={productMutation.isPending}
        uploadPending={uploadMutation.isPending}
        onSubmit={(values) => productMutation.mutate(values)}
        onAddImage={(file) =>
          editingProduct &&
          setCropTarget({ productId: editingProduct.id, file })
        }
        setPrimaryImage={setPrimaryImageMutation}
        reorderImages={reorderImagesMutation}
        deleteImage={deleteImageMutation}
        onClose={() => {
          setShowProductForm(false);
          setEditingProductId(null);
        }}
      />

      {/* Depois do modal de produto no DOM: como os dois usam o mesmo
          z-index, o portal montado por último fica por cima. */}
      <ImageCropDialog
        open={cropTarget != null}
        file={cropTarget?.file ?? null}
        onCancel={() => setCropTarget(null)}
        onConfirm={async (croppedFile) => {
          if (!cropTarget) return;
          // `mutateAsync` só resolve depois do `onSuccess` (invalidateCatalog),
          // então quando fechamos o modal a imagem nova já chegou — nada de
          // "fecha e some, aí de repente troca". Se der erro, rejeita e o
          // próprio modal mostra a mensagem e continua aberto.
          await uploadMutation.mutateAsync({
            productId: cropTarget.productId,
            file: croppedFile,
          });
          setCropTarget(null);
        }}
      />

      {sort === 'manual' && view === 'grid' ? (
        <p className="text-2xs text-muted-foreground">
          Mude para a visão em lista para reordenar com as setas.
        </p>
      ) : null}

      <ProductCollection
        products={visibleProducts}
        view={view}
        selectedIds={selectedIds}
        reorderable={sort === 'manual'}
        onToggleSelect={toggleSelect}
        onEdit={openProductForm}
        onArchive={confirmArchive}
        onDuplicate={(item) => duplicateMutation.mutate(item.id)}
        onToggleAvailability={(item) =>
          patchMutation.mutate({
            id: item.id,
            body: { isAvailable: !item.isAvailable },
          })
        }
        onUpload={(item, file) => setCropTarget({ productId: item.id, file })}
        onMove={moveProduct}
      />

      <ProductBulkBar
        count={selectedIds.size}
        busy={bulkMutation.isPending}
        onClear={() => setSelectedIds(new Set())}
        onPause={() =>
          bulkMutation.mutate({
            ids: [...selectedIds],
            body: { isAvailable: false },
          })
        }
        onResume={() =>
          bulkMutation.mutate({
            ids: [...selectedIds],
            body: { isAvailable: true },
          })
        }
        onArchive={bulkArchive}
      />
    </section>
  );
}
