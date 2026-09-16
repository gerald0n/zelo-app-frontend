import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import { requireRequestStoreId } from '@/modules/tenant/resolve-store-id';
import {
  PUSH_TEMPLATE_SELECT,
  mapPushTemplate,
  type AdminPushTemplate,
  type PushTemplateMode,
  type PushTemplateUpdate,
} from './shared';

export type { AdminPushTemplate };

export async function listPushTemplates(): Promise<
  Result<AdminPushTemplate[]>
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const storeId = await requireRequestStoreId();
  if (!storeId.ok) return storeId;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('push_templates')
    .select(PUSH_TEMPLATE_SELECT)
    .eq('store_id', storeId.data)
    .order('created_at', { ascending: false });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar os modelos.', {
      cause: error,
    });
  }
  return ok((data ?? []).map(mapPushTemplate));
}

export type CreatePushTemplateInput = {
  title: string;
  body: string;
  url?: string | null;
  mode: PushTemplateMode;
  scheduledAt?: string | null;
};

function validateScheduling(
  mode: PushTemplateMode,
  scheduledAt: string | null | undefined,
): Result<true> {
  if (mode !== 'scheduled') return ok(true);
  if (!scheduledAt) {
    return err('VALIDATION_ERROR', 'Informe o dia e horário do agendamento.');
  }
  if (new Date(scheduledAt).getTime() <= Date.now()) {
    return err('VALIDATION_ERROR', 'O horário agendado precisa ser no futuro.');
  }
  return ok(true);
}

export async function createPushTemplate(
  input: CreatePushTemplateInput,
): Promise<Result<AdminPushTemplate>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const scheduling = validateScheduling(input.mode, input.scheduledAt);
  if (!scheduling.ok) return scheduling;
  const storeId = await requireRequestStoreId();
  if (!storeId.ok) return storeId;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('push_templates')
    .insert({
      store_id: storeId.data,
      title: input.title,
      body: input.body,
      url: input.url ?? null,
      mode: input.mode,
      scheduled_at: input.mode === 'scheduled' ? input.scheduledAt : null,
      status: input.mode === 'scheduled' ? 'scheduled' : 'draft',
      created_by: auth.data.id,
    })
    .select(PUSH_TEMPLATE_SELECT)
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível criar o modelo.', {
      cause: error,
    });
  }
  await writeAuditLog({
    actorId: auth.data.id,
    action: 'push_template.create',
    entityType: 'push_template',
    entityId: data.id,
  });
  return ok(mapPushTemplate(data));
}

export type UpdatePushTemplatePatch = {
  title?: string;
  body?: string;
  url?: string | null;
  mode?: PushTemplateMode;
  scheduledAt?: string | null;
};

export async function updatePushTemplate(
  id: string,
  patch: UpdatePushTemplatePatch,
): Promise<Result<AdminPushTemplate>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const storeId = await requireRequestStoreId();
  if (!storeId.ok) return storeId;

  const admin = createAdminSupabaseClient();
  const { data: existing, error: findError } = await admin
    .from('push_templates')
    .select('mode, status')
    .eq('id', id)
    .eq('store_id', storeId.data)
    .maybeSingle();
  if (findError) {
    return err('INTERNAL_ERROR', 'Não foi possível localizar o modelo.', {
      cause: findError,
    });
  }
  if (!existing) return err('NOT_FOUND', 'Modelo não encontrado.');

  const nextMode = patch.mode ?? (existing.mode as PushTemplateMode);
  const nextScheduledAt =
    patch.scheduledAt !== undefined ? patch.scheduledAt : undefined;

  // Reagendar (ou trocar pra agendado) exige horário válido no futuro;
  // editar um modelo manual, ou um agendado sem mudar o horário, não exige.
  if (nextMode === 'scheduled' && patch.scheduledAt !== undefined) {
    const scheduling = validateScheduling(nextMode, nextScheduledAt);
    if (!scheduling.ok) return scheduling;
  }

  const update: PushTemplateUpdate = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.body !== undefined) update.body = patch.body;
  if (patch.url !== undefined) update.url = patch.url;
  if (patch.mode !== undefined) {
    update.mode = patch.mode;
    update.status = patch.mode === 'scheduled' ? 'scheduled' : 'draft';
    if (patch.mode === 'manual') update.scheduled_at = null;
  }
  if (patch.scheduledAt !== undefined) {
    update.scheduled_at = patch.scheduledAt;
    if (nextMode === 'scheduled') update.status = 'scheduled';
  }

  const { data, error } = await admin
    .from('push_templates')
    .update(update)
    .eq('id', id)
    .eq('store_id', storeId.data)
    .select(PUSH_TEMPLATE_SELECT)
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível atualizar o modelo.', {
      cause: error,
    });
  }
  await writeAuditLog({
    actorId: auth.data.id,
    action: 'push_template.update',
    entityType: 'push_template',
    entityId: id,
  });
  return ok(mapPushTemplate(data));
}

export async function cancelScheduledPushTemplate(
  id: string,
): Promise<Result<AdminPushTemplate>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const storeId = await requireRequestStoreId();
  if (!storeId.ok) return storeId;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('push_templates')
    .update({
      status: 'draft',
      scheduled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('store_id', storeId.data)
    .eq('status', 'scheduled')
    .select(PUSH_TEMPLATE_SELECT)
    .single();

  if (error || !data) {
    return err(
      'INTERNAL_ERROR',
      'Não foi possível cancelar o agendamento.',
      { cause: error },
    );
  }
  await writeAuditLog({
    actorId: auth.data.id,
    action: 'push_template.cancel_schedule',
    entityType: 'push_template',
    entityId: id,
  });
  return ok(mapPushTemplate(data));
}

export async function deletePushTemplate(id: string): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const storeId = await requireRequestStoreId();
  if (!storeId.ok) return storeId;

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from('push_templates')
    .delete()
    .eq('id', id)
    .eq('store_id', storeId.data);
  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível remover o modelo.', {
      cause: error,
    });
  }
  await writeAuditLog({
    actorId: auth.data.id,
    action: 'push_template.delete',
    entityType: 'push_template',
    entityId: id,
  });
  return ok(true as const);
}
