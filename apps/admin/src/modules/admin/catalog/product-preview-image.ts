import 'server-only';

import sharp from 'sharp';
import { err, ok, type Result } from '@/lib/errors';
import { productImagePublicUrl } from '@/lib/constants';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import { getAdminProduct } from '@/modules/admin/catalog/products';

type PreviewImageResult = { previewImageUrl: string; previewImageAltText: string };

/**
 * Upload da foto de preview de um sabor de pizza — sem borda, só o recheio,
 * pra não conflitar com a borda da massa sobreposta no client. Diferente de
 * `uploadProductImage`, não é uma galeria: 1 imagem por produto, sem
 * `is_primary`/`sort_order`. Um novo upload substitui e apaga a anterior do
 * storage (não há histórico).
 */
export async function uploadProductPreviewImage(options: {
  productId: string;
  file: File;
  altText: string;
}): Promise<Result<PreviewImageResult>> {
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
  if (product.data.productType !== 'pizza_flavor') {
    return err(
      'VALIDATION_ERROR',
      'Imagem de preview só se aplica a sabores de pizza.',
    );
  }

  // Não confia no Content-Type do cliente: re-encoda a imagem no servidor.
  // Mesmo pipeline de `uploadProductImage` (recorte 1:1, WebP, descarta EXIF)
  // — o círculo do preview no client é exibido com `object-cover`, então o
  // quadrado recortado aqui é o que aparece lá.
  const source = Buffer.from(await options.file.arrayBuffer());
  let normalized: Buffer;
  try {
    const pipeline = sharp(source, { failOn: 'error' }).rotate();
    const meta = await pipeline.metadata();
    if (!meta.width || !meta.height) {
      return err('VALIDATION_ERROR', 'Arquivo de imagem inválido.');
    }
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
  const storagePath = `${options.productId}/preview-${crypto.randomUUID()}.webp`;

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

  const { data: current } = await admin
    .from('products')
    .select('preview_image_storage_path')
    .eq('id', options.productId)
    .maybeSingle();

  const altText = options.altText.trim() || product.data.name;

  const { error: updateError } = await admin
    .from('products')
    .update({
      preview_image_storage_path: storagePath,
      preview_image_alt_text: altText,
    })
    .eq('id', options.productId);

  if (updateError) {
    await admin.storage.from('product-images').remove([storagePath]);
    return err('INTERNAL_ERROR', 'Não foi possível salvar a imagem.', {
      cause: updateError,
    });
  }

  if (current?.preview_image_storage_path) {
    await admin.storage
      .from('product-images')
      .remove([current.preview_image_storage_path]);
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'product.preview_image.upload',
    entityType: 'product',
    entityId: options.productId,
    metadata: { storagePath },
  });

  return ok({
    previewImageUrl: productImagePublicUrl(storagePath, {
      width: 400,
      height: 400,
    }),
    previewImageAltText: altText,
  });
}

export async function deleteProductPreviewImage(
  productId: string,
): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('products')
    .select('preview_image_storage_path')
    .eq('id', productId)
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível remover a imagem.', {
      cause: error,
    });
  }
  if (!data?.preview_image_storage_path) return err('NOT_FOUND', 'Imagem não encontrada.');

  await admin.storage
    .from('product-images')
    .remove([data.preview_image_storage_path]);

  const { error: updateError } = await admin
    .from('products')
    .update({ preview_image_storage_path: null, preview_image_alt_text: null })
    .eq('id', productId);

  if (updateError) {
    return err('INTERNAL_ERROR', 'Não foi possível remover a imagem.', {
      cause: updateError,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'product.preview_image.delete',
    entityType: 'product',
    entityId: productId,
    metadata: {},
  });

  return ok(true);
}
