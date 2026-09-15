'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Search, Heart } from 'lucide-react';
import { BestSellersSection } from '@/components/BestSellersSection';
import DesktopCartPanel from '@/components/DesktopCartPanel';
import MenuHeroCarousel from '@/components/MenuHeroCarousel';
import PizzaBuilder from '@/components/PizzaBuilder';
import { PizzaEntryCard } from '@/components/PizzaEntryCard';
import ProductCard from '@/components/ProductCard';
import { Testimonials } from '@/components/Testimonials';
import StoreHeader, {
  STORE_HEADER_COMPACT_HEIGHT,
} from '@/components/StoreHeader';
import StoreStrip from '@/components/StoreStrip';
import {
  type CatalogBanner,
  type CatalogCategory,
  type CatalogPizzaAddon,
  type CatalogPizzaSize,
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
  banners: CatalogBanner[];
  pizzaSizes: CatalogPizzaSize[];
  pizzaAddons: CatalogPizzaAddon[];
};

export default function HomeCatalog({
  categories,
  products,
  categoryNames,
  testimonials,
  bestSellerProductIds,
  banners,
  pizzaSizes,
  pizzaAddons,
}: Props) {
  const [active, setActive] = useState<Filter>('Todos');
  const [pizzaBuilderOpen, setPizzaBuilderOpen] = useState(false);

  const pizzaFlavors = useMemo(
    () => products.filter((p) => p.productType === 'pizza_flavor'),
    [products],
  );
  const pizzaCategoryId = pizzaFlavors[0]?.categoryId;
  const pizzaStartingPriceCents = useMemo(() => {
    const defaultSize = pizzaSizes[0];
    if (!defaultSize) return 0;
    const prices = pizzaFlavors
      .filter((f) => f.available)
      .map(
        (f) =>
          f.pizzaPrices?.find((p) => p.sizeId === defaultSize.id)
            ?.priceCents ?? 0,
      )
      .filter((price) => price > 0);
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [pizzaFlavors, pizzaSizes]);
  /** Listagem normal do cardápio nunca mostra sabor de pizza como card avulso. */
  const listableProducts = useMemo(
    () => products.filter((p) => p.productType !== 'pizza_flavor'),
    [products],
  );
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
    const byId = new Map(
      listableProducts.map((product) => [product.id, product]),
    );
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
      items: listableProducts.filter((product) => product.available).slice(0, 3),
      ranked: false,
    };
  }, [listableProducts, bestSellerProductIds]);

  const filtered = useMemo(() => {
    if (active === 'Favoritos') {
      return listableProducts.filter((product) => favorites.has(product.id));
    }
    if (active === 'Todos') return listableProducts;
    return listableProducts.filter((product) => product.categoryId === active);
  }, [active, favorites, listableProducts]);

  const showPizzaEntry =
    pizzaFlavors.length > 0 &&
    (active === 'Todos' || active === pizzaCategoryId);

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
        <MenuHeroCarousel banners={banners} />

        <BestSellersSection
          items={bestSellers.items}
          ranked={bestSellers.ranked}
          categoryNames={categoryNames}
          quantityByProduct={quantityByProduct}
          onAdd={addProduct}
        />

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
          {filtered.length === 0 && !showPizzaEntry ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {active === 'Favoritos'
                ? 'Nenhum favorito ainda. Toque no coração de um produto para salvar.'
                : 'Nenhum produto nesta categoria.'}
            </p>
          ) : (
            <ul className="mt-2.5 flex flex-col gap-2.5 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] lg:gap-3">
              {showPizzaEntry ? (
                <li className="reveal-rise lg:h-full" style={{ '--i': 0 } as CSSProperties}>
                  <PizzaEntryCard
                    startingPriceCents={pizzaStartingPriceCents}
                    onOpen={() => setPizzaBuilderOpen(true)}
                  />
                </li>
              ) : null}
              {filtered.map((product, index) => (
                <li
                  key={product.id}
                  className="reveal-rise lg:h-full"
                  style={{ '--i': index + (showPizzaEntry ? 1 : 0) } as CSSProperties}
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

      <PizzaBuilder
        open={pizzaBuilderOpen}
        onClose={() => setPizzaBuilderOpen(false)}
        flavors={pizzaFlavors}
        sizes={pizzaSizes}
        addons={pizzaAddons}
      />
    </div>
  );
}
