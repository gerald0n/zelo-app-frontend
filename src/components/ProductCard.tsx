'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { ProductThumb } from '@/components/product-thumb';
import { CatalogItemActions } from '@/components/CartQtyStepper';
import {
  categoryTone,
  formatCatalogPrice,
  type CatalogProduct,
} from '@/modules/catalog/types';
import { useCart } from '@/contexts/CartContext';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import { cn } from '@/lib/utils';

type Props = {
  product: CatalogProduct;
  vertical?: boolean;
  categoryName?: string;
};

export default function ProductCard({
  product,
  vertical = false,
  categoryName,
}: Props) {
  const { addItem, items } = useCart();
  const { favorites, toggleFavorite, notify } = useShopExperience();
  const isFavorite = favorites.has(product.id);
  const quantityInCart = items
    .filter((item) => item.productId === product.id)
    .reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = () => {
    if (!product.available) {
      notify(`${product.name} está indisponível no momento.`, 'error');
      return;
    }
    addItem(product, 1, []);
    notify(`${product.name} adicionado ao carrinho.`);
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(product.id, product.name);
  };

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-card transition-colors duration-150 hover:border-foreground/15',
        vertical
          ? 'flex min-h-[286px] flex-col p-0'
          : 'flex items-center gap-3 p-2.5',
        !product.available && 'opacity-60',
      )}
    >
      <div className={cn('relative shrink-0', vertical && 'w-full')}>
        <ProductThumb
          tone={categoryTone(categoryName ?? product.slug)}
          src={product.image}
          alt={product.imageAlt ?? product.name}
          className={
            vertical ? 'h-[128px] w-full rounded-none' : 'size-20 rounded-lg'
          }
          iconClassName={vertical ? 'size-10' : 'size-9'}
        />
        {!product.available && vertical ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <span className="text-2xs font-semibold text-primary-foreground">
              Indisponível
            </span>
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleFavorite}
          aria-label={
            isFavorite
              ? `Remover ${product.name} dos favoritos`
              : `Adicionar ${product.name} aos favoritos`
          }
          className={cn(
            'absolute flex items-center justify-center rounded-full bg-card/80 backdrop-blur transition-transform duration-150 active:scale-90',
            vertical
              ? 'top-[7px] right-[7px] size-[30px]'
              : 'left-1.5 top-1.5 size-7',
          )}
        >
          <Heart
            className={cn(
              'transition-colors',
              vertical ? 'size-[17px]' : 'size-4',
              isFavorite
                ? 'fill-primary text-primary'
                : 'text-muted-foreground',
            )}
          />
        </button>
      </div>

      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2.5',
          vertical && 'p-2.5',
        )}
      >
        <div className="min-w-0 flex-1">
          {product.available ? (
            <Link
              href={`/produto/${product.slug}`}
              className="font-semibold leading-tight text-card-foreground"
            >
              {product.name}
              <span className="sr-only"> — ver detalhes</span>
            </Link>
          ) : (
            <p className="font-semibold leading-tight text-card-foreground">
              {product.name}
              <span className="ml-2 text-xs font-medium text-muted-foreground">
                Indisponível
              </span>
            </p>
          )}
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {product.description}
          </p>
          <div className="mt-1.5 flex min-w-0 items-baseline gap-1.5">
            <span className="font-serif text-base font-semibold tabular-nums text-primary">
              {formatCatalogPrice(product.price)}
            </span>
            {product.weight ? (
              <span className="text-xs text-muted-foreground">
                · {product.weight}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end">
          <CatalogItemActions
            compact
            productId={product.id}
            productName={product.name}
            quantity={quantityInCart}
            available={product.available}
            onAdd={addToCart}
          />
        </div>
      </div>
    </article>
  );
}
