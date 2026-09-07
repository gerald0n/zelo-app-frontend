import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import { getPublicStore } from '@/modules/catalog/catalog-repository';
import { mapBusinessHour } from '@/modules/catalog/mappers';
import { getAdminStore } from '@/modules/admin/catalog/store';
import type { AdminBlackout, AdminBusinessHourInput } from '@/modules/admin/types';

export async function listAdminBusinessHours(): Promise<
  Result<AdminBusinessHourInput[]>
> {
  const store = await getAdminStore();
  if (!store.ok) return store;
  if (!store.data) return err('NOT_FOUND', 'Loja não encontrada.');
  return ok(store.data.businessHours);
}

export async function replaceAdminBusinessHours(
  hours: AdminBusinessHourInput[],
): Promise<Result<AdminBusinessHourInput[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (hours.length !== 7) {
    return err('VALIDATION_ERROR', 'Informe os 7 dias da semana.');
  }

  const weekdays = new Set(hours.map((hour) => hour.weekday));
  if (weekdays.size !== 7) {
    return err('VALIDATION_ERROR', 'Cada dia da semana deve aparecer uma vez.');
  }

  for (const hour of hours) {
    if (hour.weekday < 0 || hour.weekday > 6) {
      return err('VALIDATION_ERROR', 'Dia da semana inválido.');
    }
    if (
      !hour.isClosed &&
      (!hour.opensAt || !hour.closesAt || hour.opensAt >= hour.closesAt)
    ) {
      return err(
        'VALIDATION_ERROR',
        'Horário inválido: abertura deve ser antes do fechamento.',
      );
    }
  }

  const storeResult = await getPublicStore();
  if (!storeResult.ok) return storeResult;
  if (!storeResult.data) return err('NOT_FOUND', 'Loja não encontrada.');

  const admin = createAdminSupabaseClient();
  const rows = hours.map((hour) => ({
    store_id: storeResult.data!.id,
    weekday: hour.weekday,
    opens_at: hour.isClosed ? null : hour.opensAt,
    closes_at: hour.isClosed ? null : hour.closesAt,
    is_closed: hour.isClosed,
    delivery_enabled: hour.deliveryEnabled,
    pickup_enabled: hour.pickupEnabled,
  }));

  const { error } = await admin.from('store_business_hours').upsert(rows, {
    onConflict: 'store_id,weekday',
  });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível salvar os horários.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'store.business_hours.update',
    entityType: 'store',
    entityId: storeResult.data.id,
  });

  const { data: refreshed, error: readError } = await admin
    .from('store_business_hours')
    .select('*')
    .eq('store_id', storeResult.data.id)
    .order('weekday', { ascending: true });

  if (readError) {
    return err('INTERNAL_ERROR', 'Não foi possível ler os horários.', {
      cause: readError,
    });
  }

  return ok((refreshed ?? []).map(mapBusinessHour));
}

export async function listAdminBlackouts(): Promise<Result<AdminBlackout[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const store = await getPublicStore();
  if (!store.ok) return store;
  if (!store.data) return err('NOT_FOUND', 'Loja não encontrada.');

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('store_blackout_periods')
    .select('id, starts_at, ends_at, reason')
    .eq('store_id', store.data.id)
    .order('starts_at', { ascending: true });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar bloqueios.', {
      cause: error,
    });
  }

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      reason: row.reason,
    })),
  );
}

export async function createAdminBlackout(input: {
  startsAt: string;
  endsAt: string;
  reason?: string | null;
}): Promise<Result<AdminBlackout>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (new Date(input.endsAt) <= new Date(input.startsAt)) {
    return err('VALIDATION_ERROR', 'O fim do bloqueio deve ser após o início.');
  }

  const store = await getPublicStore();
  if (!store.ok) return store;
  if (!store.data) return err('NOT_FOUND', 'Loja não encontrada.');

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('store_blackout_periods')
    .insert({
      store_id: store.data.id,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      reason: input.reason?.trim() || null,
    })
    .select('id, starts_at, ends_at, reason')
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível criar o bloqueio.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'store.blackout.create',
    entityType: 'store_blackout',
    entityId: data.id,
  });

  return ok({
    id: data.id,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    reason: data.reason,
  });
}

export async function deleteAdminBlackout(
  blackoutId: string,
): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('store_blackout_periods')
    .delete()
    .eq('id', blackoutId)
    .select('id')
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível remover o bloqueio.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Bloqueio não encontrado.');

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'store.blackout.delete',
    entityType: 'store_blackout',
    entityId: blackoutId,
  });

  return ok(true);
}
