import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';

/**
 * Grava a ordem de produtos ou categorias. `orderedIds` tem que ser **todos**
 * os registros não arquivados, na ordem desejada — o cliente monta a lista
 * global mesmo quando o usuário só move dentro de uma categoria, pra não
 * embaralhar o resto. `sort_order` vira o índice (0..n).
 */

export async function reorderAdminProducts(options: {
  orderedIds: string[];
}): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data: current, error } = await admin
    .from('products')
    .select('id')
    .is('archived_at', null);

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível reordenar os produtos.', {
      cause: error,
    });
  }

  const ids = new Set((current ?? []).map((row) => row.id));
  if (
    ids.size !== options.orderedIds.length ||
    options.orderedIds.some((id) => !ids.has(id))
  ) {
    return err('VALIDATION_ERROR', 'A lista de produtos não confere.');
  }

  for (let index = 0; index < options.orderedIds.length; index += 1) {
    const { error: updateError } = await admin
      .from('products')
      .update({ sort_order: index })
      .eq('id', options.orderedIds[index]);
    if (updateError) {
      return err('INTERNAL_ERROR', 'Não foi possível reordenar os produtos.', {
        cause: updateError,
      });
    }
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'product.reorder',
    entityType: 'product',
    metadata: { count: options.orderedIds.length },
  });

  return ok(true);
}

export async function reorderAdminCategories(options: {
  orderedIds: string[];
}): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data: current, error } = await admin
    .from('categories')
    .select('id')
    .is('archived_at', null);

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível reordenar as categorias.', {
      cause: error,
    });
  }

  const ids = new Set((current ?? []).map((row) => row.id));
  if (
    ids.size !== options.orderedIds.length ||
    options.orderedIds.some((id) => !ids.has(id))
  ) {
    return err('VALIDATION_ERROR', 'A lista de categorias não confere.');
  }

  for (let index = 0; index < options.orderedIds.length; index += 1) {
    const { error: updateError } = await admin
      .from('categories')
      .update({ sort_order: index })
      .eq('id', options.orderedIds[index]);
    if (updateError) {
      return err(
        'INTERNAL_ERROR',
        'Não foi possível reordenar as categorias.',
        {
          cause: updateError,
        },
      );
    }
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'category.reorder',
    entityType: 'category',
    metadata: { count: options.orderedIds.length },
  });

  return ok(true);
}
