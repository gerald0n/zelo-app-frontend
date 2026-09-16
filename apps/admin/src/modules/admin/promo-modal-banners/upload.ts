import 'server-only';

import sharp from 'sharp';
import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import {
  PROMO_MODAL_BANNER_SELECT,
  mapPromoModalBanner,
  type AdminPromoModalBanner,
  type PromoModalBannerImageVariant,
  type PromoModalBannerUpdate,
} from './shared';

/** Mesmas dimensões da arte atual (public/promo/banner-*.png). */
const VARIANT_SIZE: Record<PromoModalBannerImageVariant, [number, number]> = {
  vertical: [941, 1672],
  horizontal: [1672, 941],
};

const VARIANT_COLUMN: Record<PromoModalBannerImageVariant, string> = {
  vertical: 'storage_path_vertical',
  horizontal: 'storage_path_horizontal',
};

export async function uploadPromoModalBannerImage(options: {
  bannerId: string;
  variant: PromoModalBannerImageVariant;
  file: File;
}): Promise<Result<AdminPromoModalBanner>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowed.has(options.file.type)) {
    return err('VALIDATION_ERROR', 'Use imagem JPEG, PNG ou WebP.');
  }
  if (options.file.size > 5 * 1024 * 1024) {
    return err('VALIDATION_ERROR', 'A imagem deve ter no máximo 5 MB.');
  }

  const column = VARIANT_COLUMN[options.variant];
  const admin = createAdminSupabaseClient();
  const { data: existing, error: findError } = await admin
    .from('promo_modal_banners')
    .select(column)
    .eq('id', options.bannerId)
    .maybeSingle<Record<string, string>>();
  if (findError) {
    return err('INTERNAL_ERROR', 'Não foi possível localizar o banner.', {
      cause: findError,
    });
  }
  if (!existing) return err('NOT_FOUND', 'Banner não encontrado.');

  // Não confia no Content-Type do cliente: re-encoda no servidor.
  const source = Buffer.from(await options.file.arrayBuffer());
  let normalized: Buffer;
  try {
    const pipeline = sharp(source, { failOn: 'error' }).rotate();
    const meta = await pipeline.metadata();
    if (!meta.width || !meta.height) {
      return err('VALIDATION_ERROR', 'Arquivo de imagem inválido.');
    }
    const [width, height] = VARIANT_SIZE[options.variant];
    normalized = await pipeline
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return err('VALIDATION_ERROR', 'Arquivo de imagem inválido.');
  }

  const storagePath = `modal/${options.bannerId}/${options.variant}-${crypto.randomUUID()}.webp`;
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

  const previousPath = existing[column];
  const update: PromoModalBannerUpdate =
    options.variant === 'vertical'
      ? { storage_path_vertical: storagePath, updated_at: new Date().toISOString() }
      : { storage_path_horizontal: storagePath, updated_at: new Date().toISOString() };
  const { data, error } = await admin
    .from('promo_modal_banners')
    .update(update)
    .eq('id', options.bannerId)
    .select(PROMO_MODAL_BANNER_SELECT)
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
    action: 'promo_modal_banner.upload_image',
    entityType: 'promo_modal_banner',
    entityId: options.bannerId,
  });
  return ok(mapPromoModalBanner(data));
}
