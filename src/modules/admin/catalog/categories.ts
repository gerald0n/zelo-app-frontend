import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import type { AdminCategory } from '@/modules/admin/types';
import type { Database } from '@/types/database';

type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

export async function listAdminCategories(): Promise<Result<AdminCategory[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('categories')
    .select('id, name, description, sort_order, is_active, archived_at')
    .is('archived_at', null)
    .order('sort_order', { ascending: true });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar categorias.', {
      cause: error,
    });
  }

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      sortOrder: row.sort_order,
      isActive: row.is_active,
    })),
  );
}

export async function createAdminCategory(input: {
  name: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<Result<AdminCategory>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('categories')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      sort_order: input.sortOrder ?? 0,
      is_active: input.isActive ?? true,
    })
    .select('id, name, description, sort_order, is_active')
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível criar a categoria.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'category.create',
    entityType: 'category',
    entityId: data.id,
    metadata: { name: data.name },
  });

  return ok({
    id: data.id,
    name: data.name,
    description: data.description,
    sortOrder: data.sort_order,
    isActive: data.is_active,
  });
}

export async function updateAdminCategory(options: {
  categoryId: string;
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<Result<AdminCategory>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const patch: CategoryUpdate = {};
  if (typeof options.name === 'string') patch.name = options.name.trim();
  if (options.description !== undefined) {
    patch.description = options.description?.trim() || null;
  }
  if (typeof options.sortOrder === 'number') patch.sort_order = options.sortOrder;
  if (typeof options.isActive === 'boolean') patch.is_active = options.isActive;

  if (Object.keys(patch).length === 0) {
    return err('VALIDATION_ERROR', 'Nenhuma alteração informada.');
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('categories')
    .update(patch)
    .eq('id', options.categoryId)
    .is('archived_at', null)
    .select('id, name, description, sort_order, is_active')
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível atualizar a categoria.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Categoria não encontrada.');

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'category.update',
    entityType: 'category',
    entityId: data.id,
    metadata: patch,
  });

  return ok({
    id: data.id,
    name: data.name,
    description: data.description,
    sortOrder: data.sort_order,
    isActive: data.is_active,
  });
}

export async function archiveAdminCategory(
  categoryId: string,
): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('categories')
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq('id', categoryId)
    .is('archived_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível arquivar a categoria.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Categoria não encontrada.');

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'category.archive',
    entityType: 'category',
    entityId: categoryId,
  });

  return ok(true);
}
