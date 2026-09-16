import { bannerImagePublicUrl } from '@/lib/constants';
import type { Database } from '@/types/database';

export type PromoModalBannerUpdate =
  Database['public']['Tables']['promo_modal_banners']['Update'];

export type AdminPromoModalBanner = {
  id: string;
  title: string;
  linkHref: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  storagePathVertical: string | null;
  storagePathHorizontal: string | null;
  imageUrlVertical: string | null;
  imageUrlHorizontal: string | null;
};

export type PromoModalBannerRow = {
  id: string;
  title: string;
  link_href: string | null;
  sort_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  storage_path_vertical: string;
  storage_path_horizontal: string;
};

export function mapPromoModalBanner(
  row: PromoModalBannerRow,
): AdminPromoModalBanner {
  return {
    id: row.id,
    title: row.title,
    linkHref: row.link_href,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    storagePathVertical: row.storage_path_vertical || null,
    storagePathHorizontal: row.storage_path_horizontal || null,
    imageUrlVertical: row.storage_path_vertical
      ? bannerImagePublicUrl(row.storage_path_vertical, { width: 500 })
      : null,
    imageUrlHorizontal: row.storage_path_horizontal
      ? bannerImagePublicUrl(row.storage_path_horizontal, { width: 800 })
      : null,
  };
}

export const PROMO_MODAL_BANNER_SELECT =
  'id, title, link_href, sort_order, is_active, starts_at, ends_at, storage_path_vertical, storage_path_horizontal';

export type PromoModalBannerImageVariant = 'vertical' | 'horizontal';
