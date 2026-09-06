'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { cn } from '@/lib/cn';
import {
  centsToReais,
  emptyProductForm,
  productSchema,
  type ProductForm,
} from '@/app/admin/catalogo/catalog-forms';
import { ProductFormModal } from '@/app/admin/catalogo/_tabs/ProductFormModal';
import { ProductListRow } from '@/app/admin/catalogo/_tabs/ProductListRow';
import { ProductGridCard } from '@/app/admin/catalogo/_tabs/ProductGridCard';
import { ProductStats } from '@/app/admin/catalogo/_tabs/ProductStats';
import { ProductBulkBar } from '@/app/admin/catalogo/_tabs/ProductBulkBar';
import { useProductMutations } from '@/app/admin/catalogo/_tabs/useProductMutations';
import {
  ProductToolbar,
  type ProductSort,
  type ProductStatusFilter,
  type ProductView,
} from '@/app/admin/catalogo/_tabs/ProductToolbar';
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
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(
    null,
  );
  const [showProductForm, setShowProductForm] = useState(false);

  const productForm = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: emptyProductForm(''),
  });

  const { productMutation, patchMutation, bulkMutation, uploadMutation } =
    useProductMutations({
      editingProduct,
      invalidateCatalog,
      onError,
      onProductSaved: () => {
        setShowProductForm(false);
        setEditingProduct(null);
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

  const countFor = (categoryId: string | null) =>
    categoryId === null
      ? products.length
      : products.filter((p) => p.categoryId === categoryId).length;

  const toggleSelect = (product: AdminProduct) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(product.id)) next.delete(product.id);
      else next.add(product.id);
      return next;
    });
  };

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

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {[{ id: null, name: 'Todos' }, ...categories].map((item) => (
          <button
            key={item.id ?? 'all'}
            type="button"
            onClick={() => setCategoryFilter(item.id)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-2xs font-semibold transition-colors',
              categoryFilter === item.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:bg-accent',
            )}
          >
            {item.name} ({countFor(item.id)})
          </button>
        ))}
      </div>

      <ProductFormModal
        open={showProductForm}
        form={productForm}
        editingProduct={editingProduct !== null}
        categories={categories}
        addons={addons}
        isPending={productMutation.isPending}
        onSubmit={(values) => productMutation.mutate(values)}
        onClose={() => {
          setShowProductForm(false);
          setEditingProduct(null);
        }}
      />

      {visibleProducts.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum produto encontrado.
        </p>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
          {visibleProducts.map((product) => (
            <ProductGridCard
              key={product.id}
              product={product}
              selected={selectedIds.has(product.id)}
              onToggleSelect={toggleSelect}
              onEdit={openProductForm}
              onArchive={confirmArchive}
              onToggleAvailability={(item) =>
                patchMutation.mutate({
                  id: item.id,
                  body: { isAvailable: !item.isAvailable },
                })
              }
              onUpload={(item, file) =>
                uploadMutation.mutate({ productId: item.id, file })
              }
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleProducts.map((product) => (
            <ProductListRow
              key={product.id}
              product={product}
              onEdit={openProductForm}
              onArchive={confirmArchive}
              onToggleAvailability={(item) =>
                patchMutation.mutate({
                  id: item.id,
                  body: { isAvailable: !item.isAvailable },
                })
              }
              onUpload={(item, file) =>
                uploadMutation.mutate({ productId: item.id, file })
              }
            />
          ))}
        </div>
      )}

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
