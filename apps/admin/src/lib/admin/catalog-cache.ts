import type { QueryClient } from '@tanstack/react-query';
import { adminKeys } from '@/lib/query-keys';
import type { CatalogResponse } from '@/app/catalogo/catalog-forms';

/**
 * Edições otimistas do cache da query `adminKeys.catalog()` — todas as abas de
 * `/catalogo` leem dessa mesma query. Cada função tira um retrato antes de
 * mexer e devolve o contexto de rollback para o `onError` do React Query.
 *
 * Toda coleção do catálogo é uma lista de itens com `id: string`, então o
 * casamento por id serve para as cinco (`categories`, `products`, `addons`,
 * `promotions`, `coupons`).
 */
export type CatalogCollection = keyof CatalogResponse;

export type CatalogRollback = { previous: CatalogResponse | undefined };

async function snapshot(qc: QueryClient): Promise<CatalogRollback> {
  await qc.cancelQueries({ queryKey: adminKeys.catalog() });
  return { previous: qc.getQueryData<CatalogResponse>(adminKeys.catalog()) };
}

/** Merge raso num item da coleção. */
export async function patchCatalogItem<K extends CatalogCollection>(
  qc: QueryClient,
  collection: K,
  id: string,
  patch: Partial<CatalogResponse[K][number]>,
): Promise<CatalogRollback> {
  const ctx = await snapshot(qc);
  qc.setQueryData<CatalogResponse>(adminKeys.catalog(), (current) => {
    if (!current) return current;
    const items = current[collection] as ReadonlyArray<{ id: string }>;
    const next = items.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    );
    return { ...current, [collection]: next } as CatalogResponse;
  });
  return ctx;
}

/** Remove um item da lista (arquivar/excluir). */
export async function removeCatalogItem(
  qc: QueryClient,
  collection: CatalogCollection,
  id: string,
): Promise<CatalogRollback> {
  const ctx = await snapshot(qc);
  qc.setQueryData<CatalogResponse>(adminKeys.catalog(), (current) => {
    if (!current) return current;
    const items = current[collection] as ReadonlyArray<{ id: string }>;
    const next = items.filter((item) => item.id !== id);
    return { ...current, [collection]: next } as CatalogResponse;
  });
  return ctx;
}

/**
 * Reordena `products` na hora a partir da lista completa de ids na nova ordem
 * (o backend regrava `sort_order` de todos). Mesmo desempate do
 * `byManualOrder`.
 */
export async function reorderCatalogProducts(
  qc: QueryClient,
  orderedIds: string[],
): Promise<CatalogRollback> {
  const ctx = await snapshot(qc);
  const rank = new Map(orderedIds.map((id, index) => [id, index]));
  qc.setQueryData<CatalogResponse>(adminKeys.catalog(), (current) => {
    if (!current) return current;
    const products = [...current.products]
      .map((product) => ({
        ...product,
        sortOrder: rank.get(product.id) ?? product.sortOrder,
      }))
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR'),
      );
    return { ...current, products };
  });
  return ctx;
}

/** Restaura o retrato tirado por uma das funções acima. */
export function rollbackCatalog(qc: QueryClient, ctx?: CatalogRollback): void {
  if (ctx?.previous) {
    qc.setQueryData(adminKeys.catalog(), ctx.previous);
  }
}
