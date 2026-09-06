import { productImagePublicUrl } from '@/lib/constants';
import type { AdminProduct, AdminProductImage } from '@/modules/admin/types';

export const PRODUCT_ADMIN_SELECT = `
  id,
  category_id,
  slug,
  name,
  description,
  price_cents,
  weight_min_grams,
  weight_max_grams,
  stock_quantity,
  is_active,
  is_available,
  archived_at,
  sort_order,
  categories ( name ),
  product_images ( id, storage_path, alt_text, sort_order, is_primary ),
  product_add_ons ( add_on_id )
`;

export function mapAdminImages(
  rows: Array<{
    id: string;
    storage_path: string;
    alt_text: string;
    sort_order: number;
    is_primary: boolean;
  }> | null,
): AdminProductImage[] {
  return [...(rows ?? [])]
    .sort(
      (a, b) =>
        Number(b.is_primary) - Number(a.is_primary) ||
        a.sort_order - b.sort_order,
    )
    .map((image) => ({
      id: image.id,
      storagePath: image.storage_path,
      altText: image.alt_text,
      sortOrder: image.sort_order,
      isPrimary: image.is_primary,
      url: productImagePublicUrl(image.storage_path, { width: 400 }),
    }));
}

export function mapAdminProduct(row: {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  weight_min_grams: number | null;
  weight_max_grams: number | null;
  stock_quantity: number | null;
  is_active: boolean;
  is_available: boolean;
  archived_at: string | null;
  sort_order: number;
  categories: { name: string } | Array<{ name: string }> | null;
  product_images: Array<{
    id: string;
    storage_path: string;
    alt_text: string;
    sort_order: number;
    is_primary: boolean;
  }> | null;
  product_add_ons: Array<{ add_on_id: string }> | null;
}): AdminProduct {
  const category = Array.isArray(row.categories)
    ? row.categories[0]
    : row.categories;
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: category?.name ?? 'Sem categoria',
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    weightMinGrams: row.weight_min_grams,
    weightMaxGrams: row.weight_max_grams,
    stockQuantity: row.stock_quantity,
    isActive: row.is_active,
    isAvailable: row.is_available,
    archivedAt: row.archived_at,
    sortOrder: row.sort_order,
    images: mapAdminImages(row.product_images),
    addonIds: (row.product_add_ons ?? []).map((link) => link.add_on_id),
  };
}
