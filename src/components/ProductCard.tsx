'use client';

import Link from 'next/link';
import { Heart, Plus } from 'lucide-react';
import { ProductThumb } from '@/components/product-thumb';
import { CatalogCartControls } from '@/components/CartQtyStepper';
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
  categoryName?: string;
  /** @deprecated mantido por compatibilidade — o card é sempre foto-primeiro. */
  vertical?: boolean;
};

export default function ProductCard({ product, categoryName }: Props) {
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
    notify(`${product.name} adicionado à sacola.`);
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(product.id, product.name);
  };

  const thumb = (
    <ProductThumb
      tone={categoryTone(categoryName ?? product.slug)}
      src={product.image}
      alt={product.imageAlt ?? product.name}
      className="aspect-[16/10] w-full"
      iconClassName="size-9"
    />
  );

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-card shadow-[0_1px_3px_rgba(60,40,35,0.06),0_8px_24px_rgba(60,40,35,0.07)] transition-colors',
        !product.available && 'opacity-55',
      )}
    >
      <div className="relative">
        {product.available ? (
          <Link
            href={`/produto/${product.slug}`}
            className="block"
            aria-label={`${product.name} — ver detalhes`}
          >
            {thumb}
          </Link>
        ) : (
          <div className="block">{thumb}</div>
        )}

        {!product.available ? (
          <span className="absolute left-3 top-3 rounded-full bg-background/85 px-2 py-0.5 text-2xs font-semibold text-muted-foreground backdrop-blur">
            Esgotado hoje
          </span>
        ) : null}

        <button
          type="button"
          onClick={handleFavorite}
          aria-label={
            isFavorite
              ? `Remover ${product.name} dos favoritos`
              : `Adicionar ${product.name} aos favoritos`
          }
          className="absolute right-2.5 top-2.5 flex size-8 items-center justify-center rounded-full bg-background/60 text-primary backdrop-blur transition-transform duration-100 active:scale-90"
        >
          <Heart
            className={cn(
              'size-4 transition-colors',
              isFavorite ? 'fill-primary text-primary' : 'text-muted-foreground',
            )}
          />
        </button>
      </div>

      <div className="flex items-end justify-between gap-3 p-3">
        <div className="min-w-0 flex-1">
          {product.available ? (
            <Link
              href={`/produto/${product.slug}`}
              className="font-medium leading-tight text-card-foreground"
            >
              {product.name}
            </Link>
          ) : (
            <p className="font-medium leading-tight text-card-foreground">
              {product.name}
            </p>
          )}
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {product.description}
          </p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold tabular-nums text-foreground">
              {formatCatalogPrice(product.price)}
            </span>
            {product.weight ? (
              <span className="text-2xs text-muted-foreground">
                {product.weight}
              </span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0">
          {quantityInCart > 0 ? (
            <CatalogCartControls
              compact
              productId={product.id}
              productName={product.name}
              quantity={quantityInCart}
              onIncrease={addToCart}
            />
          ) : product.available ? (
            <button
              type="button"
              aria-label={`Adicionar ${product.name} à sacola`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                addToCart();
              }}
              className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-100 active:scale-90"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
