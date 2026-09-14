import 'server-only';

import sharp from 'sharp';
import { err, ok, type Result } from '@/lib/errors';
import { bannerImagePublicUrl } from '@/lib/constants';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import type { Database } from '@/types/database';

type BannerUpdate = Database['public']['Tables']['promo_banners']['Update'];

export type AdminBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  linkHref: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  storagePath: string | null;
  imageUrl: string | null;
};

type BannerRow = {
  id: string;
  title: string;
  subtitle: string | null;
  link_href: string | null;
  sort_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  storage_path: string;
};

function mapBanner(row: BannerRow): AdminBanner {
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

const SELECT =
  'id, title, subtitle, link_href, sort_order, is_active, starts_at, ends_at, storage_path';

export async function listAdminBanners(): Promise<Result<AdminBanner[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('promo_banners')
    .select(SELECT)
    .order('sort_order', { ascending: true });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar os banners.', {
      cause: error,
    });
  }
  return ok((data ?? []).map(mapBanner));
}

export async function createBanner(input: {
  title: string;
  subtitle?: string | null;
  linkHref?: string | null;
  sortOrder?: number;
}): Promise<Result<AdminBanner>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('promo_banners')
    // Sem imagem ainda: `storage_path` vazio até o primeiro upload; banner
    // fica inativo pro público até ter imagem (ver createBanner + is_active).
    .insert({
      title: input.title,
      subtitle: input.subtitle ?? null,
      link_href: input.linkHref ?? null,
      sort_order: input.sortOrder ?? 0,
      storage_path: '',
      is_active: false,
    })
    .select(SELECT)
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
    title?: string;
    subtitle?: string | null;
    linkHref?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
  },
): Promise<Result<AdminBanner>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const update: BannerUpdate = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.subtitle !== undefined) update.subtitle = patch.subtitle;
  if (patch.linkHref !== undefined) update.link_href = patch.linkHref;
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;
  if (patch.startsAt !== undefined) update.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) update.ends_at = patch.endsAt;

  const { data, error } = await admin
    .from('promo_banners')
    .update(update)
    .eq('id', id)
    .select(SELECT)
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

  const admin = createAdminSupabaseClient();
  const { data: banner } = await admin
    .from('promo_banners')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();

  if (banner?.storage_path) {
    await admin.storage.from('banner-images').remove([banner.storage_path]);
  }

  const { error } = await admin.from('promo_banners').delete().eq('id', id);
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

export async function uploadBannerImage(options: {
  bannerId: string;
  file: File;
}): Promise<Result<AdminBanner>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowed.has(options.file.type)) {
    return err('VALIDATION_ERROR', 'Use imagem JPEG, PNG ou WebP.');
  }
  if (options.file.size > 5 * 1024 * 1024) {
    return err('VALIDATION_ERROR', 'A imagem deve ter no máximo 5 MB.');
  }

  const admin = createAdminSupabaseClient();
  const { data: existing, error: findError } = await admin
    .from('promo_banners')
    .select('storage_path')
    .eq('id', options.bannerId)
    .maybeSingle();
  if (findError) {
    return err('INTERNAL_ERROR', 'Não foi possível localizar o banner.', {
      cause: findError,
    });
  }
  if (!existing) return err('NOT_FOUND', 'Banner não encontrado.');

  // Não confia no Content-Type do cliente: re-encoda no servidor. Banner é
  // wide (carrossel), então só limita o tamanho máximo (`inside`) em vez de
  // recortar quadrado como a imagem de produto.
  const source = Buffer.from(await options.file.arrayBuffer());
  let normalized: Buffer;
  try {
    const pipeline = sharp(source, { failOn: 'error' }).rotate();
    const meta = await pipeline.metadata();
    if (!meta.width || !meta.height) {
      return err('VALIDATION_ERROR', 'Arquivo de imagem inválido.');
    }
    normalized = await pipeline
      .resize(1600, 900, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return err('VALIDATION_ERROR', 'Arquivo de imagem inválido.');
  }

  const storagePath = `${options.bannerId}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await admin.storage
    .from('banner-images')
    .upload(storagePath, normalized, {
      contentType: 'image/webp',
      upsert: false,
    });
  if (uploadError) {
    return err('INTERNAL_ERROR', 'Não foi possível enviar a imagem.', {
      cause: uploadError,
    });
  }

  const previousPath = existing.storage_path;
  const { data, error } = await admin
    .from('promo_banners')
    .update({ storage_path: storagePath, updated_at: new Date().toISOString() })
    .eq('id', options.bannerId)
    .select(SELECT)
    .single();

  if (error || !data) {
    await admin.storage.from('banner-images').remove([storagePath]);
    return err('INTERNAL_ERROR', 'Não foi possível salvar a imagem.', {
      cause: error,
    });
  }

  if (previousPath) {
    await admin.storage.from('banner-images').remove([previousPath]);
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'banner.upload_image',
    entityType: 'banner',
    entityId: options.bannerId,
  });
  return ok(mapBanner(data));
}
