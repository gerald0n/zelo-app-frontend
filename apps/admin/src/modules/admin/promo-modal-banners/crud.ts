import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import {
  PROMO_MODAL_BANNER_SELECT,
  mapPromoModalBanner,
  type AdminPromoModalBanner,
  type PromoModalBannerUpdate,
} from './shared';

export type { AdminPromoModalBanner };

export async function listAdminPromoModalBanners(): Promise<
  Result<AdminPromoModalBanner[]>
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('promo_modal_banners')
    .select(PROMO_MODAL_BANNER_SELECT)
    .order('sort_order', { ascending: true });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar os banners.', {
      cause: error,
    });
  }
  return ok((data ?? []).map(mapPromoModalBanner));
}

export async function createPromoModalBanner(input: {
  linkHref?: string | null;
  sortOrder?: number;
}): Promise<Result<AdminPromoModalBanner>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('promo_modal_banners')
    // Sem as duas imagens ainda: fica inativo pro público até ter ambas
    // (ver getPublicPromoModalBanners, que exige as duas preenchidas).
    .insert({
      link_href: input.linkHref ?? null,
      sort_order: input.sortOrder ?? 0,
      storage_path_vertical: '',
      storage_path_horizontal: '',
      is_active: false,
    })
    .select(PROMO_MODAL_BANNER_SELECT)
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível criar o banner.', {
      cause: error,
    });
  }
  await writeAuditLog({
    actorId: auth.data.id,
    action: 'promo_modal_banner.create',
    entityType: 'promo_modal_banner',
    entityId: data.id,
  });
  return ok(mapPromoModalBanner(data));
}

export async function updatePromoModalBanner(
  id: string,
  patch: {
    title?: string | null;
    linkHref?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
  },
): Promise<Result<AdminPromoModalBanner>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const update: PromoModalBannerUpdate = {
    updated_at: new Date().toISOString(),
  };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.linkHref !== undefined) update.link_href = patch.linkHref;
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;
  if (patch.startsAt !== undefined) update.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) update.ends_at = patch.endsAt;

  const { data, error } = await admin
    .from('promo_modal_banners')
    .update(update)
    .eq('id', id)
    .select(PROMO_MODAL_BANNER_SELECT)
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível atualizar o banner.', {
      cause: error,
    });
  }
  await writeAuditLog({
    actorId: auth.data.id,
    action: 'promo_modal_banner.update',
    entityType: 'promo_modal_banner',
    entityId: id,
  });
  return ok(mapPromoModalBanner(data));
}

export async function deletePromoModalBanner(id: string): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data: banner } = await admin
    .from('promo_modal_banners')
    .select('storage_path_vertical, storage_path_horizontal')
    .eq('id', id)
    .maybeSingle();

  const paths = [
    banner?.storage_path_vertical,
    banner?.storage_path_horizontal,
  ].filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    await admin.storage.from('banner-images').remove(paths);
  }

  const { error } = await admin.from('promo_modal_banners').delete().eq('id', id);
  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível remover o banner.', {
      cause: error,
    });
  }
  await writeAuditLog({
    actorId: auth.data.id,
    action: 'promo_modal_banner.delete',
    entityType: 'promo_modal_banner',
    entityId: id,
  });
  return ok(true as const);
}
