'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, Heart, Search } from 'lucide-react';
import DesktopCartPanel from '@/components/DesktopCartPanel';
import ProductCard from '@/components/ProductCard';
import StoreHeader from '@/components/StoreHeader';
import { ProductThumb } from '@/components/product-thumb';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useStoreHoursLabel, useStoreOpen } from '@/hooks/useStoreOpen';
import {
  categoryTone,
  formatCatalogPrice,
  type CatalogCategory,
  type CatalogProduct,
} from '@/modules/catalog/types';
import { useCart } from '@/contexts/CartContext';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import { cn } from '@/lib/utils';

type Filter = 'Todos' | 'Favoritos' | string;

type Props = {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  categoryNames: Record<string, string>;
};

export default function HomeCatalog({
  categories,
  products,
  categoryNames,
}: Props) {
  const [active, setActive] = useState<Filter>('Todos');
  const { addItem, subtotal, totalItems } = useCart();
  const { favorites, notify } = useShopExperience();
  const { showSideCategories, showPersistentCart } = useResponsiveLayout();
  const storeOpen = useStoreOpen();
  const hoursLabel = useStoreHoursLabel();

  const feature = useMemo(
    () => products.find((product) => product.available) ?? null,
    [products],
  );

  const filters: { id: Filter; label: string }[] = [
    { id: 'Favoritos', label: 'Favoritos' },
    { id: 'Todos', label: 'Todos' },
    ...categories.map((category) => ({ id: category.id, label: category.name })),
  ];

  const filtered = useMemo(() => {
    if (active === 'Favoritos') {
      return products.filter((product) => favorites.has(product.id));
    }
    if (active === 'Todos') return products;
    return products.filter((product) => product.categoryId === active);
  }, [active, favorites, products]);

  /** Em "Todos", agrupa por categoria; senão, uma grade só. */
  const groups = useMemo(() => {
    if (active !== 'Todos') return null;
    return categories
      .map((category) => ({
        category,
        items: products.filter(
          (product) => product.categoryId === category.id,
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [active, categories, products]);

  const addProduct = (product: CatalogProduct) => {
    if (!product.available) {
      notify(`${product.name} está indisponível no momento.`, 'error');
      return;
    }
    addItem(product, 1, []);
    notify(`${product.name} adicionado à sacola.`);
  };

  const gridClass = cn(
    'grid gap-3',
    showSideCategories ? 'sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1',
  );

  return (
    <div className="flex w-full lg:min-h-dvh">
      {showSideCategories ? (
        <aside className="flex w-[220px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-card px-3 py-4 lg:sticky lg:top-0 lg:h-dvh">
          <Link
            href="/busca"
            className="mb-3 flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Search className="size-4" aria-hidden="true" /> Buscar
          </Link>
          <p className="px-2.5 pb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            Categorias
          </p>
          {filters.map((filter) => (
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
      ) : null}

      <div className="relative mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-1 flex-col max-lg:min-h-full lg:max-w-none">
        {/* Camada de vidro fixa — a marca + as categorias. */}
        <div className="glass-chrome sticky top-0 z-40 rounded-b-3xl">
          <StoreHeader />
          {!showSideCategories ? (
            <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-2.5 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActive(filter.id)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-[color,background-color,transform] duration-150 active:scale-95',
                    active === filter.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card/55 text-muted-foreground',
                  )}
                >
                  {filter.id === 'Favoritos' ? (
                    <Heart className="size-3.5" aria-hidden="true" />
                  ) : null}
                  {filter.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex-1 px-4 pb-28 pt-3 lg:pb-8">
          {/* Cartão de aviso — status, horário, regra das 17h. */}
          <div className="flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-[0_1px_3px_rgba(60,40,35,0.06)]">
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-full text-primary-foreground',
                storeOpen ? 'bg-success' : 'bg-primary',
              )}
            >
              <Clock className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-card-foreground">
                {storeOpen ? hoursLabel : 'Fechado agora'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {storeOpen
                  ? 'Pereiro, CE · entrega e retirada'
                  : 'Você ainda pode montar o pedido e agendar'}
              </p>
            </div>
          </div>

          {active === 'Todos' && feature ? (
            <FeatureCard
              product={feature}
              categoryName={categoryNames[feature.categoryId]}
              onAdd={() => addProduct(feature)}
            />
          ) : null}

          {groups ? (
            <div className="mt-6 flex flex-col gap-7">
              {groups.map((group) => (
                <section key={group.category.id} aria-labelledby={`g-${group.category.id}`}>
                  <h2
                    id={`g-${group.category.id}`}
                    className="mb-3 font-serif text-lg font-semibold text-foreground"
                  >
                    {group.category.name}
                  </h2>
                  <ul className={gridClass}>
                    {group.items.map((product, index) => (
                      <li
                        key={product.id}
                        className="reveal-rise"
                        style={{ '--i': index } as CSSProperties}
                      >
                        <ProductCard
                          product={product}
                          categoryName={categoryNames[product.categoryId]}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <section className="mt-6" aria-labelledby="menu-heading">
              <h2
                id="menu-heading"
                className="mb-3 font-serif text-lg font-semibold text-foreground"
              >
                {active === 'Favoritos'
                  ? 'Favoritos'
                  : (categoryNames[active] ?? 'Cardápio')}
              </h2>
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {active === 'Favoritos'
                    ? 'Nenhum favorito ainda. Toque no coração de um doce para salvar.'
                    : 'Nenhum produto nesta categoria.'}
                </p>
              ) : (
                <ul className={gridClass}>
                  {filtered.map((product, index) => (
                    <li
                      key={product.id}
                      className="reveal-rise"
                      style={{ '--i': index } as CSSProperties}
                    >
                      <ProductCard
                        product={product}
                        categoryName={categoryNames[product.categoryId]}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {totalItems > 0 && !showPersistentCart ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-[74px] z-40 px-4 lg:hidden">
            <Link
              href="/carrinho"
              className="liquid-glass pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-transform duration-100 active:scale-[0.99]"
            >
              <span className="text-sm font-semibold">
                Ver sacola · {totalItems} {totalItems === 1 ? 'item' : 'itens'}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-bold tabular-nums">
                {formatCatalogPrice(subtotal)}
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </Link>
          </div>
        ) : null}
      </div>

      {showPersistentCart ? <DesktopCartPanel /> : null}
    </div>
  );
}

function FeatureCard({
  product,
  categoryName,
  onAdd,
}: {
  product: CatalogProduct;
  categoryName?: string;
  onAdd: () => void;
}) {
  return (
    <article className="mt-4 overflow-hidden rounded-3xl bg-card shadow-[0_1px_3px_rgba(60,40,35,0.06),0_12px_30px_rgba(60,40,35,0.08)]">
      <Link href={`/produto/${product.slug}`} className="block">
        <ProductThumb
          tone={categoryTone(categoryName ?? product.slug)}
          src={product.image}
          alt={product.imageAlt ?? product.name}
          className="aspect-[16/9] w-full"
          iconClassName="size-12"
          width={800}
        />
      </Link>
      <div className="p-4">
        <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-primary">
          Destaque de hoje
        </p>
        <h2 className="mt-1 font-serif text-xl font-semibold leading-tight text-card-foreground">
          {product.name}
        </h2>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {product.description}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {formatCatalogPrice(product.price)}
            {product.weight ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {product.weight}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onAdd();
            }}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-transform duration-100 active:scale-95"
          >
            Adicionar
          </button>
        </div>
      </div>
    </article>
  );
}
