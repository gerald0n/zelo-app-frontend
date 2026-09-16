import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import { requireRequestStoreId } from '@/modules/tenant/resolve-store-id';
import {
  BANNER_SELECT,
  mapBanner,
  type AdminBanner,
  type BannerUpdate,
} from './shared';

export type { AdminBanner };

export async function listAdminBanners(): Promise<Result<AdminBanner[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const storeId = await requireRequestStoreId();
  if (!storeId.ok) return storeId;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('promo_banners')
    .select(BANNER_SELECT)
    .eq('store_id', storeId.data)
    .order('sort_order', { ascending: true });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar os banners.', {
      cause: error,
    });
  }
  return ok((data ?? []).map(mapBanner));
}

export async function createBanner(input: {
  linkHref?: string | null;
  sortOrder?: number;
}): Promise<Result<AdminBanner>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const storeId = await requireRequestStoreId();
  if (!storeId.ok) return storeId;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('promo_banners')
    // Sem imagem ainda: `storage_path` vazio até o primeiro upload; banner
    // fica inativo pro público até ter imagem (ver createBanner + is_active).
    // Título/subtítulo não são mais configuráveis: a imagem já traz a
    // informação completa do banner.
    .insert({
      store_id: storeId.data,
      link_href: input.linkHref ?? null,
      sort_order: input.sortOrder ?? 0,
      storage_path: '',
      is_active: false,
    })
    .select(BANNER_SELECT)
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível criar o banner.', {
      cause: error,
    });
  }
  await writeAuditLog({
    actorId: auth.data.id,
    action: 'banner.create',
    entityType: 'banner',
    entityId: data.id,
  });
  return ok(mapBanner(data));
}

export async function updateBanner(
  id: string,
  patch: {
    linkHref?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
  },
): Promise<Result<AdminBanner>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const storeId = await requireRequestStoreId();
  if (!storeId.ok) return storeId;

  const admin = createAdminSupabaseClient();
  const update: BannerUpdate = { updated_at: new Date().toISOString() };
  if (patch.linkHref !== undefined) update.link_href = patch.linkHref;
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;
  if (patch.startsAt !== undefined) update.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) update.ends_at = patch.endsAt;

  const { data, error } = await admin
    .from('promo_banners')
    .update(update)
    .eq('id', id)
    .eq('store_id', storeId.data)
    .select(BANNER_SELECT)
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível atualizar o banner.', {
      cause: error,
    });
  }
  await writeAuditLog({
    actorId: auth.data.id,
    action: 'banner.update',
    entityType: 'banner',
    entityId: id,
  });
  return ok(mapBanner(data));
}

export async function deleteBanner(id: string): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const storeId = await requireRequestStoreId();
  if (!storeId.ok) return storeId;

  const admin = createAdminSupabaseClient();
  const { data: banner } = await admin
    .from('promo_banners')
    .select('storage_path')
    .eq('id', id)
    .eq('store_id', storeId.data)
    .maybeSingle();

  if (banner?.storage_path) {
    await admin.storage.from('banner-images').remove([banner.storage_path]);
  }

  const { error } = await admin
    .from('promo_banners')
    .delete()
    .eq('id', id)
    .eq('store_id', storeId.data);
  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível remover o banner.', {
      cause: error,
    });
  }
  await writeAuditLog({
    actorId: auth.data.id,
    action: 'banner.delete',
    entityType: 'banner',
    entityId: id,
  });
  return ok(true as const);
}
