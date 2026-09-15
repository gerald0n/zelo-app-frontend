import type { CatalogProduct } from '@/modules/catalog/types';
import { unitPriceWithAddons, type CartItem } from '@/modules/carts/types';

function pizzaFlavorPriceCents(product: CatalogProduct, sizeId: string) {
  return product.pizzaPrices?.find((p) => p.sizeId === sizeId)?.priceCents;
}

export type CartRevalidationChange = {
  itemId: string;
  productName: string;
  reason:
    | 'product_unavailable'
    | 'product_removed'
    | 'price_changed'
    | 'addon_removed'
    | 'addon_price_changed';
  detail?: string;
};

export type CartRevalidationResult = {
  items: CartItem[];
  changes: CartRevalidationChange[];
};

/**
 * Revalida itens locais contra o catálogo atual (preços e disponibilidade).
 * Totais do carrinho são indicativos até o checkout no servidor.
 */
export function revalidateCartAgainstCatalog(
  items: CartItem[],
  products: CatalogProduct[],
): CartRevalidationResult {
  const byId = new Map(products.map((product) => [product.id, product]));
  const changes: CartRevalidationChange[] = [];
  const next: CartItem[] = [];

  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) {
      changes.push({
        itemId: item.id,
        productName: item.name,
        reason: 'product_removed',
        detail: 'Produto não está mais no cardápio.',
      });
      continue;
    }

    if (!product.available) {
      changes.push({
        itemId: item.id,
        productName: item.name,
        reason: 'product_unavailable',
        detail: 'Produto indisponível no momento.',
      });
      continue;
    }

    if (item.pizzaSize) {
      const price1 = pizzaFlavorPriceCents(product, item.pizzaSize.id);
      if (price1 === undefined) {
        changes.push({
          itemId: item.id,
          productName: item.name,
          reason: 'product_unavailable',
          detail: `Sabor não disponível no tamanho ${item.pizzaSize.name}.`,
        });
        continue;
      }

      let secondaryProduct: CatalogProduct | undefined;
      let price2: number | undefined;
      if (item.secondaryFlavor) {
        secondaryProduct = byId.get(item.secondaryFlavor.productId);
        if (!secondaryProduct || !secondaryProduct.available) {
          changes.push({
            itemId: item.id,
            productName: item.name,
            reason: 'product_unavailable',
            detail: `Sabor "${item.secondaryFlavor.name}" indisponível.`,
          });
          continue;
        }
        price2 = pizzaFlavorPriceCents(secondaryProduct, item.pizzaSize.id);
        if (price2 === undefined) {
          changes.push({
            itemId: item.id,
            productName: item.name,
            reason: 'product_unavailable',
            detail: `Sabor "${item.secondaryFlavor.name}" não disponível no tamanho ${item.pizzaSize.name}.`,
          });
          continue;
        }
      }

      const basePrice =
        secondaryProduct && price2 !== undefined
          ? Math.round((price1 + price2) / 2)
          : price1;
      const addonsTotal = (item.selectedPizzaAddons ?? []).reduce(
        (sum, a) => sum + a.priceCents,
        0,
      );
      const price = basePrice + addonsTotal;

      if (basePrice !== item.basePrice || price !== item.price) {
        changes.push({
          itemId: item.id,
          productName: item.name,
          reason: 'price_changed',
          detail: 'Preço atualizado conforme o cardápio.',
        });
      }

      const name = secondaryProduct
        ? `${product.name} / ${secondaryProduct.name}`
        : product.name;

      next.push({
        ...item,
        slug: product.slug,
        name,
        basePrice,
        price,
        image: product.image,
        secondaryFlavor: item.secondaryFlavor
          ? { ...item.secondaryFlavor, priceCents: price2 ?? 0 }
          : undefined,
      });
      continue;
    }

    const availableAddonIds = new Set(
      product.addons
        .filter((addon) => addon.isAvailable)
        .map((addon) => addon.id),
    );
    const nextAddons = [];
    for (const selected of item.selectedAddons) {
      const current = product.addons.find((addon) => addon.id === selected.id);
      if (!current || !availableAddonIds.has(current.id)) {
        changes.push({
          itemId: item.id,
          productName: item.name,
          reason: 'addon_removed',
          detail: `Adicional "${selected.name}" indisponível.`,
        });
        continue;
      }
      if (current.price !== selected.price) {
        changes.push({
          itemId: item.id,
          productName: item.name,
          reason: 'addon_price_changed',
          detail: `Preço de "${current.name}" atualizado.`,
        });
      }
      nextAddons.push({
        id: current.id,
        name: current.name,
        price: current.price,
        isAvailable: current.isAvailable,
        description: current.description,
      });
    }

    const basePrice = product.price;
    const price = unitPriceWithAddons(basePrice, nextAddons);
    if (basePrice !== item.basePrice || price !== item.price) {
      changes.push({
        itemId: item.id,
        productName: item.name,
        reason: 'price_changed',
        detail: 'Preço atualizado conforme o cardápio.',
      });
    }

    next.push({
      ...item,
      slug: product.slug,
      name: product.name,
      basePrice,
      price,
      selectedAddons: nextAddons,
      image: product.image,
    });
  }

  return { items: next, changes };
}
