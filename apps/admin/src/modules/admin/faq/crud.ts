import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import { requireRequestStoreId } from '@/modules/tenant/resolve-store-id';
import {
  FAQ_ITEM_SELECT,
  mapFaqItem,
  type AdminFaqItem,
  type FaqItemUpdate,
} from './shared';

export type { AdminFaqItem };

export async function listAdminFaqItems(): Promise<Result<AdminFaqItem[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const storeId = await requireRequestStoreId();
  if (!storeId.ok) return storeId;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('faq_items')
    .select(FAQ_ITEM_SELECT)
    .eq('store_id', storeId.data)
    .order('sort_order', { ascending: true });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar o FAQ.', {
      cause: error,
    });
  }
  return ok((data ?? []).map(mapFaqItem));
}

export async function createFaqItem(input: {
  question: string;
  answer: string;
  sortOrder?: number;
}): Promise<Result<AdminFaqItem>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const storeId = await requireRequestStoreId();
  if (!storeId.ok) return storeId;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('faq_items')
    .insert({
      store_id: storeId.data,
      question: input.question,
      answer: input.answer,
      sort_order: input.sortOrder ?? 0,
    })
    .select(FAQ_ITEM_SELECT)
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível criar a pergunta.', {
      cause: error,
    });
  }
  await writeAuditLog({
    actorId: auth.data.id,
    action: 'faq_item.create',
    entityType: 'faq_item',
    entityId: data.id,
  });
  return ok(mapFaqItem(data));
}

export async function updateFaqItem(
  id: string,
  patch: {
    question?: string;
    answer?: string;
    sortOrder?: number;
    isActive?: boolean;
  },
): Promise<Result<AdminFaqItem>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const storeId = await requireRequestStoreId();
  if (!storeId.ok) return storeId;

  const admin = createAdminSupabaseClient();
  const update: FaqItemUpdate = { updated_at: new Date().toISOString() };
  if (patch.question !== undefined) update.question = patch.question;
  if (patch.answer !== undefined) update.answer = patch.answer;
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;

  const { data, error } = await admin
    .from('faq_items')
    .update(update)
    .eq('id', id)
    .eq('store_id', storeId.data)
    .select(FAQ_ITEM_SELECT)
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível atualizar a pergunta.', {
      cause: error,
    });
  }
  await writeAuditLog({
    actorId: auth.data.id,
    action: 'faq_item.update',
    entityType: 'faq_item',
    entityId: id,
  });
  return ok(mapFaqItem(data));
}

export async function deleteFaqItem(id: string): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const storeId = await requireRequestStoreId();
  if (!storeId.ok) return storeId;

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from('faq_items')
    .delete()
    .eq('id', id)
    .eq('store_id', storeId.data);
  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível remover a pergunta.', {
      cause: error,
    });
  }
  await writeAuditLog({
    actorId: auth.data.id,
    action: 'faq_item.delete',
    entityType: 'faq_item',
    entityId: id,
  });
  return ok(true as const);
}
