import type {
  CatalogPizzaAddon,
  CatalogPizzaSize,
  CatalogProduct,
} from '@/modules/catalog/types';
import type { CartPizzaAddon } from '@/modules/carts/types';

export type AddPizzaItemArgs = {
  product: CatalogProduct;
  secondaryProduct?: CatalogProduct;
  size: CatalogPizzaSize;
  quantity: number;
  selectedPizzaAddons: Array<{
    addon: CatalogPizzaAddon;
    appliesTo: 'whole' | 'flavor1' | 'flavor2';
  }>;
  note?: string;
};

function pizzaFlavorPriceCents(
  product: CatalogProduct,
  sizeId: string,
): number {
  return (
    product.pizzaPrices?.find((p) => p.sizeId === sizeId)?.priceCents ?? 0
  );
}

/**
 * Monta os campos derivados de um item de pizza (preço = média dos sabores
 * no tamanho escolhido + adicionais aplicados) a partir da seleção do
 * construtor — usado por `cart-store.addPizzaItem` pra montar tanto a linha
 * nova quanto a assinatura de deduplicação (`isSameCartLine`).
 */
export function buildPizzaCartLine(
  args: Omit<AddPizzaItemArgs, 'quantity'>,
) {
  const { product, secondaryProduct, size, selectedPizzaAddons, note } = args;

  const price1 = pizzaFlavorPriceCents(product, size.id);
  const basePrice = secondaryProduct
    ? Math.round((price1 + pizzaFlavorPriceCents(secondaryProduct, size.id)) / 2)
    : price1;

  const pizzaAddons: CartPizzaAddon[] = selectedPizzaAddons.map(
    ({ addon, appliesTo }) => ({
      pizzaAddonId: addon.id,
      name: addon.name,
      appliesTo,
      priceCents:
        appliesTo === 'whole' ? addon.priceFullCents : addon.priceHalfCents,
    }),
  );
  const addonsTotal = pizzaAddons.reduce((sum, a) => sum + a.priceCents, 0);
  const price = basePrice + addonsTotal;

  const name = secondaryProduct
    ? `${product.name} / ${secondaryProduct.name}`
    : product.name;

  const pizzaSize = { id: size.id, name: size.name, diameterCm: size.diameterCm };
  const secondaryFlavor = secondaryProduct
    ? {
        productId: secondaryProduct.id,
        name: secondaryProduct.name,
        priceCents: pizzaFlavorPriceCents(secondaryProduct, size.id),
        image: secondaryProduct.image,
      }
    : undefined;

  return {
    name,
    basePrice,
    price,
    normalizedNote: note?.trim() || undefined,
    pizzaSize,
    secondaryFlavor,
    pizzaAddons,
  };
}
