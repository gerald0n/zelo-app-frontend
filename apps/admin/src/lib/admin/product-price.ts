/** Representative catalog price: lowest configured price among active sizes. */
export function catalogProductPrice(
  product: {
    productType: string;
    priceCents: number;
    pizzaSizePrices: Array<{ sizeId: string; priceCents: number }>;
  },
  sizes: Array<{ id: string; isActive: boolean }>,
): number {
  if (product.productType !== 'pizza_flavor') return product.priceCents;
  const activeIds = new Set(
    sizes.filter((size) => size.isActive).map((size) => size.id),
  );
  const prices = product.pizzaSizePrices
    .filter((price) => activeIds.has(price.sizeId))
    .map((price) => price.priceCents);
  return prices.length ? Math.min(...prices) : product.priceCents;
}
