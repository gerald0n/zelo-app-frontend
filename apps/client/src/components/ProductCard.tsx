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
  /**
   * `true` → linha horizontal compacta no mobile que vira cartão vertical
   * (foto no topo) a partir de `lg`. Usado nas grades (cardápio, busca).
   * `false` → sempre linha horizontal (listas de uma coluna).
   */
  responsive?: boolean;
  categoryName?: string;
};

export default function ProductCard({
  product,
  responsive = false,
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
        'flex items-center gap-3 p-2.5',
        responsive &&
          'lg:h-full lg:flex-col lg:items-stretch lg:gap-0 lg:p-0',
        !product.available && 'opacity-60',
      )}
    >
      <div className={cn('relative shrink-0', responsive && 'lg:w-full')}>
        <ProductThumb
          tone={categoryTone(categoryName ?? product.slug)}
          src={product.image}
          alt={product.imageAlt ?? product.name}
          className={cn(
            'size-20 rounded-lg',
            responsive && 'lg:h-32 lg:w-full lg:rounded-none',
          )}
          iconClassName={cn('size-9', responsive && 'lg:size-10')}
        />
        {!product.available && responsive ? (
          <div className="absolute inset-0 hidden items-center justify-center bg-black/45 lg:flex">
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
            'absolute left-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-card/80 backdrop-blur transition-transform duration-150 active:scale-90',
            responsive &&
              'lg:left-auto lg:right-[7px] lg:top-[7px] lg:size-[30px]',
          )}
        >
          <Heart
            className={cn(
              'size-4 transition-colors',
              responsive && 'lg:size-[17px]',
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
          responsive && 'lg:p-3',
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
          <div className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-1.5">
            <span className="font-serif text-base font-semibold tabular-nums text-primary">
              {formatCatalogPrice(product.price)}
            </span>
            {product.originalPrice != null ? (
              <span className="text-xs tabular-nums text-muted-foreground line-through">
                {formatCatalogPrice(product.originalPrice)}
              </span>
            ) : null}
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
