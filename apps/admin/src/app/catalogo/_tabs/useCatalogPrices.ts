'use client';

import { useMemo } from 'react';
import { catalogProductPrice } from '@/lib/admin/product-price';
import type { AdminProduct, AdminPizzaSize } from '@/modules/admin/types';

export function useCatalogPrices(
  products: AdminProduct[],
  sizes: AdminPizzaSize[],
) {
  return useMemo(
    () =>
      products.map((product) => ({
        ...product,
        priceCents: catalogProductPrice(product, sizes),
      })),
    [products, sizes],
  );
}
