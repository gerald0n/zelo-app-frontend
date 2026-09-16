import type { CartItem } from '@/modules/carts/types';
import type { CreateOrderBody } from '@/modules/orders/create-order-schema';

/** Converte os itens do carrinho pro formato de `items` esperado por `POST /api/v1/orders`. */
export function cartItemsToOrderItems(
  items: CartItem[],
): CreateOrderBody['items'] {
  return items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    customerNote: item.note || undefined,
    addOns: item.selectedAddons.map((addon) => ({
      addOnId: addon.id,
      quantity: 1,
    })),
    pizzaSizeId: item.pizzaSize?.id,
    secondaryProductId: item.secondaryFlavor?.productId,
    pizzaAddons: (item.selectedPizzaAddons ?? []).map((addon) => ({
      pizzaAddonId: addon.pizzaAddonId,
      appliesTo: addon.appliesTo,
    })),
  }));
}
