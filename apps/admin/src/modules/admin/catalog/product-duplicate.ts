import 'server-only';

import { type Result } from '@/lib/errors';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import {
  createAdminProduct,
  getAdminProduct,
} from '@/modules/admin/catalog/products';
import type { AdminProduct } from '@/modules/admin/types';

/**
 * Cria um novo produto a partir de um existente — nome "… (cópia)", mesma
 * categoria, preço, peso, estoque e adicionais. **Não** copia as imagens
 * (evita duplicar arquivos no storage); a cópia nasce sem foto. Nasce
 * pausada (`is_available = false`) pra não aparecer no catálogo antes de o
 * admin revisar. Fica logo depois do original na ordenação.
 */
export async function duplicateAdminProduct(
  productId: string,
): Promise<Result<AdminProduct>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const source = await getAdminProduct(productId);
  if (!source.ok) return source;

  const created = await createAdminProduct({
    categoryId: source.data.categoryId,
    name: `${source.data.name} (cópia)`,
    description: source.data.description,
    priceCents: source.data.priceCents,
    weightMinGrams: source.data.weightMinGrams,
    weightMaxGrams: source.data.weightMaxGrams,
    stockQuantity: source.data.stockQuantity,
    sortOrder: source.data.sortOrder + 1,
    isActive: source.data.isActive,
    isAvailable: false,
    addonIds: source.data.addonIds,
    fulfillmentLocationId: source.data.fulfillmentLocationId,
    productType: source.data.productType,
    pizzaSizePrices: source.data.pizzaSizePrices,
  });
  if (!created.ok) return created;

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'product.duplicate',
    entityType: 'product',
    entityId: created.data.id,
    metadata: { sourceId: productId },
  });

  return created;
}
