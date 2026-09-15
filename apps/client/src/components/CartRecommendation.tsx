'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { ProductThumb } from '@/components/product-thumb';
import { CatalogItemActions } from '@/components/CartQtyStepper';
import { categoryTone, formatCatalogPrice } from '@/modules/catalog/types';
import type { CatalogProduct } from '@/modules/catalog/types';
import { useCart, type CartItem } from '@/modules/carts';
import { useShopExperience } from '@/contexts/ShopExperienceContext';

/**
 * Sugestão de "comprados juntos" — só aparece quando o carrinho tem
 * exatamente 1 produto distinto (recomendação de par não generaliza pra
 * carrinho com vários itens; ver recommendations-repository.ts). Visual
 * propositalmente diferente do ProductCard do cardápio — é prova social
 * ("quem levou isso, também levou aquilo"), não mais um item de grade.
 */
export function CartRecommendation({ items }: { items: CartItem[] }) {
  const distinctProductIds = [...new Set(items.map((item) => item.productId))];
  const singleProductId =
    distinctProductIds.length === 1 ? distinctProductIds[0] : null;

  // Guarda o productId junto do resultado pra descartar (via render, não
  // setState síncrono no efeito) uma recomendação de um produto anterior
  // enquanto o fetch do produto atual ainda não voltou.
  const [fetched, setFetched] = useState<{
    productId: string;
    product: CatalogProduct | null;
  } | null>(null);
  const { addItem, items: cartItems } = useCart();
  const { notify } = useShopExperience();

  useEffect(() => {
    if (!singleProductId) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/v1/recommendations?product_id=${singleProductId}`,
          { cache: 'no-store' },
        );
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as {
          product?: CatalogProduct | null;
        };
        if (!cancelled) {
          setFetched({ productId: singleProductId, product: payload.product ?? null });
        }
      } catch {
        // Recomendação é best-effort — some em silêncio se falhar.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [singleProductId]);

  const recommended =
    fetched && fetched.productId === singleProductId ? fetched.product : null;

  if (!recommended || recommended.id === singleProductId) return null;

  const quantityInCart = cartItems
    .filter((item) => item.productId === recommended.id)
    .reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = () => {
    if (!recommended.available) {
      notify(`${recommended.name} está indisponível no momento.`, 'error');
      return;
    }
    addItem(recommended, 1, []);
    notify(`${recommended.name} adicionado ao carrinho.`);
  };

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] p-3">
      <div className="flex items-center gap-1.5 text-primary">
        <Users className="size-3.5" strokeWidth={2.25} />
        <p className="text-2xs font-semibold uppercase tracking-[0.08em]">
          Quem pediu isso, também pediu
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        <ProductThumb
          tone={categoryTone(recommended.slug)}
          src={recommended.image}
          alt={recommended.imageAlt ?? recommended.name}
          className="size-14 shrink-0 rounded-full ring-2 ring-card"
          iconClassName="size-6"
          width={160}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-card-foreground">
            {recommended.name}
          </p>
          <span className="font-serif text-sm font-semibold tabular-nums text-primary">
            {formatCatalogPrice(recommended.price)}
          </span>
        </div>
        <CatalogItemActions
          compact
          productId={recommended.id}
          productName={recommended.name}
          quantity={quantityInCart}
          available={recommended.available}
          onAdd={addToCart}
        />
      </div>
    </div>
  );
}
