import type { CatalogProduct } from '@/modules/catalog/types';

/** Acima disso o sabor entra no grupo "Premium" — mesmo corte usado no cardápio de referência. */
export const PIZZA_PREMIUM_THRESHOLD_CENTS = 5500;

export function flavorPriceCents(product: CatalogProduct, sizeId: string) {
  return product.pizzaPrices?.find((p) => p.sizeId === sizeId)?.priceCents ?? 0;
}

export function groupFlavorsByTier(
  flavors: CatalogProduct[],
  sizeId: string | undefined,
) {
  if (!sizeId) return { traditional: flavors, premium: [] as CatalogProduct[] };
  const traditional: CatalogProduct[] = [];
  const premium: CatalogProduct[] = [];
  for (const flavor of flavors) {
    if (flavorPriceCents(flavor, sizeId) > PIZZA_PREMIUM_THRESHOLD_CENTS) {
      premium.push(flavor);
    } else {
      traditional.push(flavor);
    }
  }
  return { traditional, premium };
}
