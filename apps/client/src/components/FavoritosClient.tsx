'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Heart } from 'lucide-react';
import type { CatalogProduct } from '@/modules/catalog/types';
import ProductCard from '@/components/ProductCard';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import { pageHeaderBarClass, shellContentClass } from '@/lib/layout';
import { cn } from '@/lib/cn';

export default function FavoritosClient({
  products,
}: {
  products: CatalogProduct[];
}) {
  const { favorites } = useShopExperience();

  const results = useMemo(
    () => products.filter((product) => favorites.has(product.id)),
    [products, favorites],
  );

  return (
    <div
      className={cn(
        'flex min-h-dvh w-full flex-col bg-background',
        shellContentClass,
      )}
    >
      <header className={cn(pageHeaderBarClass, 'gap-3 lg:px-0')}>
        <Link href="/" aria-label="Voltar ao cardápio" className="lg:hidden">
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="text-lg font-semibold">Favoritos</h1>
        <span className="w-6 lg:hidden" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pt-3 lg:px-0">
        {results.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 px-10 pt-12 text-center">
            <Heart className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum favorito ainda. Toque no coração de um produto para
              salvar.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-2 px-4 text-sm text-muted-foreground lg:px-0">
              {results.length}{' '}
              {results.length === 1 ? 'favorito' : 'favoritos'}
            </p>
            <div className="flex flex-col gap-2.5 px-3 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] lg:gap-3 lg:px-0">
              {results.map((product) => (
                <ProductCard key={product.id} product={product} responsive />
              ))}
            </div>
          </>
        )}
        <div className="h-10" />
      </div>
    </div>
  );
}
