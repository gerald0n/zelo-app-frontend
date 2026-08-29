import type { Database } from '@/types/database';
import { productImagePublicUrl } from '@/lib/constants';
import {
  formatWeightGrams,
  type CatalogAddon,
  type CatalogBlackout,
  type CatalogBusinessHour,
  type CatalogCategory,
  type CatalogProduct,
  type CatalogStore,
} from '@/modules/catalog/types';

type ProductRow = Database['public']['Tables']['products']['Row'];
type CategoryRow = Database['public']['Tables']['categories']['Row'];
type StoreRow = Database['public']['Tables']['stores']['Row'];
type HoursRow = Database['public']['Tables']['store_business_hours']['Row'];
type BlackoutRow = Database['public']['Tables']['store_blackout_periods']['Row'];
type ImageRow = Database['public']['Tables']['product_images']['Row'];
type AddonRow = Database['public']['Tables']['add_ons']['Row'];

type ProductJoinRow = ProductRow & {
  product_images?: ImageRow[] | null;
  product_add_ons?: Array<{
    sort_order: number;
    add_ons: AddonRow | null;
  }> | null;
};

export function mapCategory(row: CategoryRow): CatalogCategory {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
  };
}

export function mapAddon(row: AddonRow): CatalogAddon {
  return {
    id: row.id,
    name: row.name,
    price: row.price_cents,
    isAvailable: row.is_available && row.is_active && !row.archived_at,
    description: row.description,
  };
}

export function mapProduct(row: ProductJoinRow): CatalogProduct {
  const images = [...(row.product_images ?? [])].sort(
    (a, b) =>
      Number(b.is_primary) - Number(a.is_primary) ||
      a.sort_order - b.sort_order,
  );
  const primary = images[0];

  const addons = [...(row.product_add_ons ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((link) => {
      if (!link.add_ons || link.add_ons.archived_at) return null;
      return mapAddon(link.add_ons);
    })
    .filter((addon): addon is CatalogAddon => addon !== null);

  return {
    id: row.id,
    categoryId: row.category_id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? '',
    price: row.price_cents,
    image: primary ? productImagePublicUrl(primary.storage_path) : null,
    imageAlt: primary?.alt_text ?? null,
    available: row.is_available && row.is_active && !row.archived_at,
    weight: formatWeightGrams(row.weight_min_grams, row.weight_max_grams),
    addons,
    sortOrder: row.sort_order,
  };
}

export function mapBusinessHour(row: HoursRow): CatalogBusinessHour {
  return {
    weekday: row.weekday,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    isClosed: row.is_closed,
    deliveryEnabled: row.delivery_enabled,
    pickupEnabled: row.pickup_enabled,
  };
}

export function mapBlackout(
  row: Pick<BlackoutRow, 'id' | 'starts_at' | 'ends_at' | 'reason'>,
): CatalogBlackout {
  return {
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    reason: row.reason,
  };
}

export function mapStore(
  row: StoreRow,
  hours: HoursRow[],
  blackouts: Array<
    Pick<BlackoutRow, 'id' | 'starts_at' | 'ends_at' | 'reason'>
  > = [],
): CatalogStore {
  return {
    id: row.id,
    name: row.name,
    phoneE164: row.phone_e164,
    whatsappE164: row.whatsapp_e164,
    pixCopyPaste: row.pix_copy_paste,
    addressLine: row.address_line,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    freeDeliveryRadiusMeters: row.free_delivery_radius_meters,
    fixedDeliveryFeeCents: row.fixed_delivery_fee_cents,
    timezone: row.timezone,
    isOpenOverride: row.is_open_override,
    acceptsPayments: {
      pix: row.accepts_pix,
      cash: row.accepts_cash,
      card: row.accepts_card,
    },
    businessHours: hours
      .map(mapBusinessHour)
      .sort((a, b) => a.weekday - b.weekday),
    blackoutPeriods: blackouts
      .map(mapBlackout)
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      ),
  };
}
