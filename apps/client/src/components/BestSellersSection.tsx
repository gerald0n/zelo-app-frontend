'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import { CatalogCartControls } from '@/components/CartQtyStepper';
import { ProductThumb } from '@/components/product-thumb';
import {
  categoryTone,
  formatCatalogPrice,
  type CatalogProduct,
} from '@/modules/catalog/types';

type Props = {
  items: CatalogProduct[];
  ranked: boolean;
  categoryNames: Record<string, string>;
  quantityByProduct: Map<string, number>;
  onAdd: (product: CatalogProduct) => void;
};

/** Carrossel horizontal "Mais vendidos nos últimos 30 dias" da home. */
export function BestSellersSection({
  items,
  ranked,
  categoryNames,
  quantityByProduct,
  onAdd,
}: Props) {
  if (items.length === 0) return null;

  return (
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
        {items.map((product, index) => {
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
                  {ranked ? `${index + 1}º mais vendido: ` : ''}
                  Ver detalhes de {product.name}
                </span>
              </Link>
              {ranked ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-2 top-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground"
                >
                  {index + 1}º
                </span>
              ) : null}
              <div className="flex items-center gap-2.5 lg:gap-3">
                <ProductThumb
                  tone={categoryTone(categoryNames[product.categoryId] ?? '')}
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
                    onIncrease={() => onAdd(product)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onAdd(product)}
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
  );
}
