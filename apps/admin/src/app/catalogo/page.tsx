'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { apiJson } from '@/lib/api';
import { adminContainerClass } from '@/lib/layout';
import { cn } from '@/lib/cn';
import { adminKeys } from '@/lib/query-keys';
import { type CatalogResponse, type Tab } from '@/app/catalogo/catalog-forms';
import { AddonsTab } from '@/app/catalogo/_tabs/AddonsTab';
import { CategoriesTab } from '@/app/catalogo/_tabs/CategoriesTab';
import { CouponsTab } from '@/app/catalogo/_tabs/CouponsTab';
import { ProductsTab } from '@/app/catalogo/_tabs/ProductsTab';
import { PromotionsTab } from '@/app/catalogo/_tabs/PromotionsTab';

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'products', label: 'Produtos' },
  { id: 'categories', label: 'Categorias' },
  { id: 'promotions', label: 'Promoções' },
  { id: 'coupons', label: 'Cupons' },
  { id: 'addons', label: 'Adicionais' },
];

export default function AdminCatalogoPage() {
  const queryClient = useQueryClient();
  const { isAuthenticated, ready } = useRequireAdmin();
  const [tab, setTab] = useState<Tab>('products');
  const [formError, setFormError] = useState('');

  const catalogQuery = useQuery({
    queryKey: adminKeys.catalog(),
    enabled: ready && isAuthenticated,
    queryFn: () => apiJson<CatalogResponse>('/api/v1/admin/catalog'),
  });

  const categories = useMemo(
    () => catalogQuery.data?.categories ?? [],
    [catalogQuery.data?.categories],
  );
  const products = useMemo(
    () => catalogQuery.data?.products ?? [],
    [catalogQuery.data?.products],
  );
  const addons = useMemo(
    () => catalogQuery.data?.addons ?? [],
    [catalogQuery.data?.addons],
  );
  const promotions = useMemo(
    () => catalogQuery.data?.promotions ?? [],
    [catalogQuery.data?.promotions],
  );
  const coupons = useMemo(
    () => catalogQuery.data?.coupons ?? [],
    [catalogQuery.data?.coupons],
  );

  const invalidateCatalog = async () => {
    await queryClient.invalidateQueries({ queryKey: adminKeys.catalog() });
  };

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isLoading = catalogQuery.isLoading;

  return (
    <div
      className={cn(
        'min-h-dvh space-y-4 p-3 pb-24 md:px-6 md:pt-6',
        adminContainerClass,
      )}
    >
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-2xs font-bold uppercase tracking-widest text-primary">
              Gestão de catálogo
            </p>
            <h1 className="mt-1 font-serif text-xl font-bold tracking-tight md:text-2xl">
              Catálogo de produtos
            </h1>
          </div>
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent"
          >
            <ExternalLink className="size-3.5" />
            Ver cardápio
          </Link>
        </div>
        <p className="hidden max-w-prose text-xs text-muted-foreground sm:block">
          Administre a vitrine digital, o estoque de fornadas, as fichas dos
          produtos e a precificação do cardápio artesanal.
        </p>
      </header>

      <div className="flex gap-1.5">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-2xs font-semibold transition-colors',
              tab === item.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:bg-accent',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {formError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {formError}
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {tab === 'products' && !isLoading ? (
        <ProductsTab
          categories={categories}
          products={products}
          addons={addons}
          invalidateCatalog={invalidateCatalog}
          onError={setFormError}
        />
      ) : null}

      {tab === 'categories' && !isLoading ? (
        <CategoriesTab
          categories={categories}
          invalidateCatalog={invalidateCatalog}
          onError={setFormError}
        />
      ) : null}

      {tab === 'addons' && !isLoading ? (
        <AddonsTab
          addons={addons}
          invalidateCatalog={invalidateCatalog}
          onError={setFormError}
        />
      ) : null}

      {tab === 'promotions' && !isLoading ? (
        <PromotionsTab
          categories={categories}
          products={products}
          promotions={promotions}
          invalidateCatalog={invalidateCatalog}
          onError={setFormError}
        />
      ) : null}

      {tab === 'coupons' && !isLoading ? (
        <CouponsTab
          coupons={coupons}
          invalidateCatalog={invalidateCatalog}
          onError={setFormError}
        />
      ) : null}
    </div>
  );
}
