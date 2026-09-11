import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import type { AdminCategory } from '@/modules/admin/types';
import type { CategorySchedulingInput } from '@/modules/scheduling/category-rules';
import type { Database } from '@/types/database';

type CategoryRow = Database['public']['Tables']['categories']['Row'];
type CategoryUpdate = Database['public']['Tables']['categories']['Update'];
type CategoryInsert = Database['public']['Tables']['categories']['Insert'];

const CATEGORY_COLUMNS =
  'id, name, description, sort_order, is_active, archived_at, scheduling_allow_same_day, scheduling_same_day_lead_minutes, scheduling_weekday_earliest, scheduling_weekend_earliest, scheduling_slot_interval_minutes, scheduling_min_lead_minutes' as const;

function mapAdminCategory(
  row: Pick<
    CategoryRow,
    | 'id'
    | 'name'
    | 'description'
    | 'sort_order'
    | 'is_active'
    | 'scheduling_allow_same_day'
    | 'scheduling_same_day_lead_minutes'
    | 'scheduling_weekday_earliest'
    | 'scheduling_weekend_earliest'
    | 'scheduling_slot_interval_minutes'
    | 'scheduling_min_lead_minutes'
  >,
): AdminCategory {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    scheduling: {
      allowSameDay: row.scheduling_allow_same_day,
      sameDayLeadMinutes: row.scheduling_same_day_lead_minutes,
      weekdayEarliest: row.scheduling_weekday_earliest,
      weekendEarliest: row.scheduling_weekend_earliest,
      slotIntervalMinutes: row.scheduling_slot_interval_minutes,
      minLeadMinutes: row.scheduling_min_lead_minutes,
    },
  };
}

/**
 * Traduz uma CategorySchedulingInput (já validada pelo schema da rota, via
 * categorySchedulingRuleInputSchema) para as colunas snake_case da tabela.
 * Não revalida limites: quem chama esta função sempre passou pelo schema.
 */
function schedulingPatch(
  input: CategorySchedulingInput | undefined,
): Partial<CategoryUpdate> {
  const patch: Partial<CategoryUpdate> = {};
  if (!input) return patch;

  if (input.allowSameDay !== undefined) {
    patch.scheduling_allow_same_day = input.allowSameDay;
  }
  if (input.sameDayLeadMinutes !== undefined) {
    patch.scheduling_same_day_lead_minutes = input.sameDayLeadMinutes;
  }
  if (input.slotIntervalMinutes !== undefined) {
    patch.scheduling_slot_interval_minutes = input.slotIntervalMinutes;
  }
  if (input.minLeadMinutes !== undefined) {
    patch.scheduling_min_lead_minutes = input.minLeadMinutes;
  }
  if (input.weekdayEarliest !== undefined) {
    patch.scheduling_weekday_earliest = input.weekdayEarliest;
  }
  if (input.weekendEarliest !== undefined) {
    patch.scheduling_weekend_earliest = input.weekendEarliest;
  }
  return patch;
}

export async function listAdminCategories(): Promise<Result<AdminCategory[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('categories')
    .select(CATEGORY_COLUMNS)
    .is('archived_at', null)
    .order('sort_order', { ascending: true });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar categorias.', {
      cause: error,
    });
  }

  return ok((data ?? []).map(mapAdminCategory));
}

export async function createAdminCategory(input: {
  name: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  scheduling?: CategorySchedulingInput;
}): Promise<Result<AdminCategory>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const insert: CategoryInsert = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    sort_order: input.sortOrder ?? 0,
    is_active: input.isActive ?? true,
    ...schedulingPatch(input.scheduling),
  };
  const { data, error } = await admin
    .from('categories')
    .insert(insert)
    .select(CATEGORY_COLUMNS)
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

  return ok(mapAdminCategory(data));
}

export async function updateAdminCategory(options: {
  categoryId: string;
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  scheduling?: CategorySchedulingInput;
}): Promise<Result<AdminCategory>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const patch: CategoryUpdate = { ...schedulingPatch(options.scheduling) };
  if (typeof options.name === 'string') patch.name = options.name.trim();
  if (options.description !== undefined) {
    patch.description = options.description?.trim() || null;
  }
  if (typeof options.sortOrder === 'number')
    patch.sort_order = options.sortOrder;
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
    .select(CATEGORY_COLUMNS)
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

  return ok(mapAdminCategory(data));
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
