import 'server-only';

import sharp from 'sharp';
import { err, ok, type Result } from '@/lib/errors';
import { productImagePublicUrl } from '@/lib/constants';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import { getAdminProduct } from '@/modules/admin/catalog/products';
import type { AdminProductImage } from '@/modules/admin/types';

export async function uploadProductImage(options: {
  productId: string;
  file: File;
  altText: string;
  isPrimary?: boolean;
}): Promise<Result<AdminProductImage>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowed.has(options.file.type)) {
    return err('VALIDATION_ERROR', 'Use imagem JPEG, PNG ou WebP.');
  }
  if (options.file.size > 5 * 1024 * 1024) {
    return err('VALIDATION_ERROR', 'A imagem deve ter no máximo 5 MB.');
  }

  const product = await getAdminProduct(options.productId);
  if (!product.ok) return product;

  // Não confia no Content-Type do cliente: re-encoda a imagem no servidor.
  // Se não for um bitmap válido (SVG, HTML, payload forjado), o sharp lança e
  // o upload é rejeitado. O re-encode também descarta metadata (EXIF/GPS).
  const source = Buffer.from(await options.file.arrayBuffer());
  let normalized: Buffer;
  try {
    const pipeline = sharp(source, { failOn: 'error' }).rotate();
    const meta = await pipeline.metadata();
    if (!meta.width || !meta.height) {
      return err('VALIDATION_ERROR', 'Arquivo de imagem inválido.');
    }
    // Toda imagem de produto é exibida 1:1 no card (admin e client). Gravamos
    // um quadrado exato pra o que aparece no card ser sempre o que foi recortado
    // — sem depender de a transformação da CDN reenquadrar. A imagem já vem
    // recortada 1:1 do modal; o `cover` aqui só absorve arredondamento de 1px
    // (e normaliza imagens antigas não-quadradas, cortando pelo centro).
    const size = Math.min(meta.width, meta.height, 2000);
    normalized = await pipeline
      .resize(size, size, {
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return err('VALIDATION_ERROR', 'Arquivo de imagem inválido.');
  }

  const admin = createAdminSupabaseClient();
  const storagePath = `${options.productId}/${crypto.randomUUID()}.webp`;

  const { error: uploadError } = await admin.storage
    .from('product-images')
    .upload(storagePath, normalized, {
      contentType: 'image/webp',
      upsert: false,
    });

  if (uploadError) {
    return err('INTERNAL_ERROR', 'Não foi possível enviar a imagem.', {
      cause: uploadError,
    });
  }

  const makePrimary =
    options.isPrimary === true || product.data.images.length === 0;

  if (makePrimary) {
    await admin
      .from('product_images')
      .update({ is_primary: false })
      .eq('product_id', options.productId);
  }

  const nextOrder =
    product.data.images.reduce(
      (max, image) => Math.max(max, image.sortOrder),
      -1,
    ) + 1;

  const { data, error } = await admin
    .from('product_images')
    .insert({
      product_id: options.productId,
      storage_path: storagePath,
      alt_text: options.altText.trim() || product.data.name,
      sort_order: nextOrder,
      is_primary: makePrimary,
    })
    .select('id, storage_path, alt_text, sort_order, is_primary')
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível salvar a imagem.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'product.image.upload',
    entityType: 'product',
    entityId: options.productId,
    metadata: { imageId: data.id },
  });

  return ok({
    id: data.id,
    storagePath: data.storage_path,
    altText: data.alt_text,
    sortOrder: data.sort_order,
    isPrimary: data.is_primary,
    url: productImagePublicUrl(data.storage_path, { width: 400, height: 400 }),
  });
}

export async function deleteProductImage(options: {
  productId: string;
  imageId: string;
}): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('product_images')
    .select('id, storage_path, is_primary')
    .eq('id', options.imageId)
    .eq('product_id', options.productId)
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível remover a imagem.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Imagem não encontrada.');

  await admin.storage.from('product-images').remove([data.storage_path]);
  await admin.from('product_images').delete().eq('id', data.id);

  if (data.is_primary) {
    const { data: next } = await admin
      .from('product_images')
      .select('id')
      .eq('product_id', options.productId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await admin
        .from('product_images')
        .update({ is_primary: true })
        .eq('id', next.id);
    }
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'product.image.delete',
    entityType: 'product',
    entityId: options.productId,
    metadata: { imageId: options.imageId },
  });

  return ok(true);
}
