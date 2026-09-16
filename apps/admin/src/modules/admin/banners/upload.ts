import 'server-only';

import sharp from 'sharp';
import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import { requireRequestStoreId } from '@/modules/tenant/resolve-store-id';
import { BANNER_SELECT, mapBanner, type AdminBanner } from './shared';

export async function uploadBannerImage(options: {
  bannerId: string;
  file: File;
}): Promise<Result<AdminBanner>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const storeId = await requireRequestStoreId();
  if (!storeId.ok) return storeId;

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
    .eq('store_id', storeId.data)
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
    .eq('store_id', storeId.data)
    .select(BANNER_SELECT)
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
