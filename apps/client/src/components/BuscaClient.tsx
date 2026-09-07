'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Frown } from 'lucide-react';
import type { CatalogProduct } from '@/modules/catalog/types';
import ProductCard from '@/components/ProductCard';
import { Input } from '@/components/ui/input';
import { pageHeaderBarClass, shellContentClass } from '@/lib/layout';
import { cn } from '@/lib/cn';

export default function BuscaClient({
  products,
}: {
  products: CatalogProduct[];
}) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    const needle = trimmed.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(needle) ||
        product.description.toLowerCase().includes(needle),
    );
  }, [products, query]);

  return (
    <div className={cn('flex min-h-dvh w-full flex-col bg-background', shellContentClass)}>
      <header className={cn(pageHeaderBarClass, 'gap-3 lg:px-0')}>
        <Link href="/" aria-label="Voltar ao cardápio" className="lg:hidden">
          <ArrowLeft className="size-6" />
        </Link>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar produtos..."
          className="h-11 flex-1"
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pt-3 lg:px-0">
        {query.trim().length < 2 ? (
          <div className="flex flex-col items-center gap-2.5 px-10 pt-12 text-center">
            <Search className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Digite pelo menos 2 caracteres para buscar
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 px-10 pt-12 text-center">
            <Frown className="size-10 text-muted-foreground" />
            <p className="mt-2 text-lg font-semibold">Nenhum resultado</p>
            <p className="text-sm leading-5 text-muted-foreground">
              Tente buscar por outro nome ou categoria.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-2 px-4 text-sm text-muted-foreground lg:px-0">
              {results.length}{' '}
              {results.length === 1 ? 'resultado' : 'resultados'}
            </p>
            <div className="flex flex-col gap-2.5 px-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:px-0 2xl:grid-cols-3">
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
