import type { AdminProduct } from '@/modules/admin/types';

/** Ordena por `sortOrder`, com o nome como desempate. */
export function byManualOrder(a: AdminProduct, b: AdminProduct) {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR');
}

/**
 * Nova ordem global de ids depois de mover um produto uma posição. A troca é
 * contra o vizinho **visível** (respeita o filtro de categoria/busca), mas o
 * retorno é a lista completa — o backend regrava `sort_order` de todos, então
 * o resto não embaralha. `null` quando não dá pra mover (ponta da lista).
 */
export function reorderedProductIds(
  allProducts: AdminProduct[],
  visibleProducts: AdminProduct[],
  movedId: string,
  direction: -1 | 1,
): string[] | null {
  const visIndex = visibleProducts.findIndex((p) => p.id === movedId);
  const neighbor = visibleProducts[visIndex + direction];
  if (visIndex === -1 || !neighbor) return null;

  const order = [...allProducts].sort(byManualOrder).map((p) => p.id);
  const from = order.indexOf(movedId);
  if (from === -1) return null;
  order.splice(from, 1);
  const neighborIndex = order.indexOf(neighbor.id);
  order.splice(
    direction === -1 ? neighborIndex : neighborIndex + 1,
    0,
    movedId,
  );
  return order;
}
