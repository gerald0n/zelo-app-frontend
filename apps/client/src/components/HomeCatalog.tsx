'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Search, Heart, Star } from 'lucide-react';
import { CatalogCartControls } from '@/components/CartQtyStepper';
import DesktopCartPanel from '@/components/DesktopCartPanel';
import MenuHeroCarousel from '@/components/MenuHeroCarousel';
import ProductCard from '@/components/ProductCard';
import { Testimonials } from '@/components/Testimonials';
import StoreHeader, {
  STORE_HEADER_COMPACT_HEIGHT,
} from '@/components/StoreHeader';
import StoreStrip from '@/components/StoreStrip';
import { ProductThumb } from '@/components/product-thumb';
import {
  categoryTone,
  formatCatalogPrice,
  type CatalogCategory,
  type CatalogProduct,
} from '@/modules/catalog/types';
import type { PublicTestimonial } from '@/modules/reviews/types';
import { useCart } from '@/contexts/CartContext';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import { cn } from '@/lib/utils';

type Filter = 'Todos' | 'Favoritos' | string;

type Props = {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  categoryNames: Record<string, string>;
  testimonials: PublicTestimonial[];
  /** IDs dos mais vendidos nos últimos 30 dias, do mais pro menos vendido. */
  bestSellerProductIds: string[];
};

export default function HomeCatalog({
  categories,
  products,
  categoryNames,
  testimonials,
  bestSellerProductIds,
}: Props) {
  const [active, setActive] = useState<Filter>('Todos');
  const { addItem, items } = useCart();
  const { favorites, notify } = useShopExperience();
  const quantityByProduct = useMemo(() => {
    const quantities = new Map<string, number>();
    for (const item of items) {
      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity,
      );
    }
    return quantities;
  }, [items]);

  const bestSellers = useMemo(() => {
    const byId = new Map(products.map((product) => [product.id, product]));
    const ranked = bestSellerProductIds
      .map((id) => byId.get(id))
      .filter(
        (product): product is CatalogProduct =>
          !!product && product.available,
      )
      .slice(0, 3);
    if (ranked.length > 0) return { items: ranked, ranked: true };
    // Loja nova / sem vendas nos últimos 30 dias: cai de volta pra ordem do
    // cardápio, pra seção não sumir logo de cara. Sem selo de posição aqui —
    // não são de fato os mais vendidos.
    return {
      items: products.filter((product) => product.available).slice(0, 3),
      ranked: false,
    };
  }, [products, bestSellerProductIds]);

  const filtered = useMemo(() => {
    if (active === 'Favoritos') {
      return products.filter((product) => favorites.has(product.id));
    }
    if (active === 'Todos') return products;
    return products.filter((product) => product.categoryId === active);
  }, [active, favorites, products]);

  const addProduct = (product: CatalogProduct) => {
    if (!product.available) {
      notify(`${product.name} está indisponível no momento.`, 'error');
      return;
    }
    addItem(product, 1, []);
    notify(`${product.name} adicionado ao carrinho.`);
  };

  const categoryFilters: { id: Filter; label: string }[] = [
    { id: 'Favoritos', label: 'Favoritos' },
    { id: 'Todos', label: 'Todos' },
    ...categories.map((category) => ({
      id: category.id,
      label: category.name,
    })),
  ];

  return (
    <div className="flex w-full lg:min-h-dvh">
      <aside className="hidden w-[220px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-background px-3 py-4 lg:flex lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)]">
        <Link
          href="/busca"
          className="mb-3 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Search className="size-4" aria-hidden="true" /> Buscar
        </Link>
        <p className="px-2.5 pb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          Categorias
        </p>
        {categoryFilters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setActive(filter.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors active:scale-[0.98]',
              active === filter.id
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-accent',
            )}
          >
            {filter.id === 'Favoritos' ? (
              <Heart className="size-4 shrink-0" aria-hidden="true" />
            ) : null}
            {filter.label}
          </button>
        ))}
      </aside>

      <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-1 flex-col bg-background max-lg:min-h-full lg:max-w-none">
        <StoreHeader />
        <StoreStrip />
        <MenuHeroCarousel />

        {bestSellers.items.length > 0 ? (
          <section className="pt-4" aria-labelledby="best-sellers-heading">
            <div className="px-4">
              <h3
                id="best-sellers-heading"
                className="font-serif text-lg font-semibold text-foreground"
              >
                Mais vendidos nos últimos 30 dias
              </h3>
            </div>
            <div className="mt-3 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {bestSellers.items.map((product, index) => {
                const quantityInCart = quantityByProduct.get(product.id) ?? 0;
                return (
                  <article
                    key={product.id}
                    className="relative flex w-[196px] shrink-0 flex-col rounded-xl border border-border bg-card p-2.5 transition-colors duration-150 hover:border-foreground/15 lg:w-[248px] lg:p-3"
                  >
                    <Link
                      href={`/produto/${product.slug}`}
                      className="absolute inset-0 z-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <span className="sr-only">
                        {bestSellers.ranked
                          ? `${index + 1}º mais vendido: `
                          : ''}
                        Ver detalhes de {product.name}
                      </span>
                    </Link>
                    {bestSellers.ranked ? (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-2 top-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground"
                      >
                        {index + 1}º
                      </span>
                    ) : null}
                    <div className="flex items-center gap-2.5 lg:gap-3">
                      <ProductThumb
                        tone={categoryTone(
                          categoryNames[product.categoryId] ?? '',
                        )}
                        src={product.image}
                        alt={product.imageAlt ?? product.name}
                        className="size-12 shrink-0 rounded-lg lg:size-16"
                        iconClassName="size-5 lg:size-7"
                        width={200}
                      />
                      <p className="text-sm font-semibold leading-tight text-card-foreground lg:text-base">
                        {product.name}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-col gap-2 lg:mt-3">
                      <span className="flex flex-wrap items-baseline gap-1.5">
                        <span className="font-serif text-base font-semibold text-primary">
                          {formatCatalogPrice(product.price)}
                        </span>
                        {product.originalPrice != null ? (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatCatalogPrice(product.originalPrice)}
                          </span>
                        ) : null}
                        {product.rating ? (
                          <span className="flex items-center gap-0.5 text-2xs text-muted-foreground">
                            <Star className="size-3 fill-amber-400 text-amber-400" />
                            {product.rating.average.toFixed(1)}
                          </span>
                        ) : null}
                      </span>
                      {quantityInCart > 0 ? (
                        <CatalogCartControls
                          compact
                          className="relative z-10 w-full"
                          productId={product.id}
                          productName={product.name}
                          quantity={quantityInCart}
                          onIncrease={() => addProduct(product)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => addProduct(product)}
                          className="relative z-10 inline-flex h-7 w-full items-center justify-center rounded-md bg-primary/10 px-2 text-2xs font-semibold text-primary transition-[background-color,transform] duration-100 hover:bg-primary/20 active:scale-[0.97] lg:h-9 lg:text-xs"
                        >
                          Adicionar
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {
          <div
            className="sticky z-30 mt-3 bg-background px-4 py-2 lg:hidden"
            style={{
              // Encosta logo abaixo da barra compacta, contando a área segura
              // (status bar / notch) no PWA instalado.
              top: `calc(env(safe-area-inset-top, 0px) + ${STORE_HEADER_COMPACT_HEIGHT}px)`,
            }}
          >
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link
                href="/busca"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
              >
                <Search className="size-3.5" aria-hidden="true" /> Buscar
              </Link>
              <button
                type="button"
                onClick={() => setActive('Favoritos')}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-[color,background-color,transform] duration-100 active:scale-95',
                  active === 'Favoritos'
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-card text-foreground hover:bg-accent',
                )}
              >
                <Heart className="size-3.5" aria-hidden="true" /> Favoritos
              </button>
              <button
                type="button"
                onClick={() => setActive('Todos')}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-[color,background-color,transform] duration-100 active:scale-95',
                  active === 'Todos'
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-card text-foreground hover:bg-accent',
                )}
              >
                Todos
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActive(category.id)}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-[color,background-color,transform] duration-100 active:scale-95',
                    active === category.id
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-card text-foreground hover:bg-accent',
                  )}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        }

        <section className="px-4 pt-2 pb-6" aria-labelledby="menu-heading">
          <h3
            id="menu-heading"
            className="font-serif text-lg font-semibold text-foreground"
          >
            {active === 'Todos'
              ? 'Cardápio'
              : active === 'Favoritos'
                ? 'Favoritos'
                : (categoryNames[active] ?? 'Cardápio')}
          </h3>
          {filtered.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {active === 'Favoritos'
                ? 'Nenhum favorito ainda. Toque no coração de um produto para salvar.'
                : 'Nenhum produto nesta categoria.'}
            </p>
          ) : (
            <ul className="mt-2.5 flex flex-col gap-2.5 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] lg:gap-3">
              {filtered.map((product, index) => (
                <li
                  key={product.id}
                  className="reveal-rise lg:h-full"
                  style={{ '--i': index } as CSSProperties}
                >
                  <ProductCard
                    product={product}
                    responsive
                    categoryName={categoryNames[product.categoryId]}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {active === 'Todos' ? (
          <Testimonials testimonials={testimonials} />
        ) : null}
      </div>

      <DesktopCartPanel />
    </div>
  );
}
