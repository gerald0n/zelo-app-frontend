/**
 * Resolução de preço promocional — espelha `private.effective_price_cents`
 * (supabase/migrations/20260904170000_promotions.sql), que é a fonte de
 * verdade usada em `private.create_order`. Esta versão em TypeScript serve só
 * para exibir o preço com desconto no catálogo público (carrinho/checkout já
 * herdam de `CatalogProduct.price`); o servidor sempre recalcula na criação
 * do pedido.
 *
 * Uma promoção efetiva por produto, por especificidade: produto > categoria >
 * loja toda. Sem acúmulo entre níveis.
 */

export type ActivePromotionScope = 'store' | 'category' | 'products';

export type ActivePromotion = {
  scope: ActivePromotionScope;
  discountPercent: number;
  categoryIds: string[];
  productIds: string[];
};

function bestDiscount(
  promotions: ActivePromotion[],
  matches: (promotion: ActivePromotion) => boolean,
): number | null {
  let best: number | null = null;
  for (const promotion of promotions) {
    if (!matches(promotion)) continue;
    if (best === null || promotion.discountPercent > best) {
      best = promotion.discountPercent;
    }
  }
  return best;
}

export function resolveDiscountPercent(
  promotions: ActivePromotion[],
  categoryId: string,
  productId: string,
): number | null {
  const productMatch = bestDiscount(
    promotions,
    (p) => p.scope === 'products' && p.productIds.includes(productId),
  );
  if (productMatch !== null) return productMatch;

  const categoryMatch = bestDiscount(
    promotions,
    (p) => p.scope === 'category' && p.categoryIds.includes(categoryId),
  );
  if (categoryMatch !== null) return categoryMatch;

  return bestDiscount(promotions, (p) => p.scope === 'store');
}

/** Arredonda por unidade, em centavos. */
export function applyDiscount(
  priceCents: number,
  discountPercent: number | null,
): number {
  if (discountPercent === null) return priceCents;
  return Math.round(priceCents * (1 - discountPercent / 100));
}
