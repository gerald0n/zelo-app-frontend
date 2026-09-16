import { bannerImagePublicUrl } from '@/lib/constants';
import type { Database } from '@/types/database';

export type BannerUpdate = Database['public']['Tables']['promo_banners']['Update'];

export type AdminBanner = {
  id: string;
  title: string | null;
  subtitle: string | null;
  linkHref: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  storagePath: string | null;
  imageUrl: string | null;
};

export type BannerRow = {
  id: string;
  title: string | null;
  subtitle: string | null;
  link_href: string | null;
  sort_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  storage_path: string;
};

export function mapBanner(row: BannerRow): AdminBanner {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    linkHref: row.link_href,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    storagePath: row.storage_path || null,
    imageUrl: row.storage_path
      ? bannerImagePublicUrl(row.storage_path, { width: 1200 })
      : null,
  };
}

export const BANNER_SELECT =
  'id, title, subtitle, link_href, sort_order, is_active, starts_at, ends_at, storage_path';
