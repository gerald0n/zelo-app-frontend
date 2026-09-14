import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import { getSatelliteLocation } from '@/modules/catalog/satellite-repository';
import {
  mapSatelliteDeliverySlot,
  mapSatelliteHour,
} from '@/modules/catalog/mappers';
import type {
  SatelliteDeliverySlot,
  SatelliteLocation,
  SatelliteWeekdayHour,
} from '@/modules/catalog/types';
import type { Database } from '@/types/database';

const SLUG = 'sao-miguel';

// Aceita HH:MM ou HH:MM:SS — o client sempre manda com segundos (":00"),
// mesmo padrão usado por `replaceAdminBusinessHours`.
const HHMM = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

type SatelliteLocationUpdate =
  Database['public']['Tables']['satellite_locations']['Update'];

export async function getAdminSatelliteLocation(): Promise<
  Result<SatelliteLocation | null>
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  return getSatelliteLocation(SLUG);
}

export async function updateAdminSatelliteLocation(input: {
  name?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  postalCode?: string | null;
  latitude?: number;
  longitude?: number;
  freeDeliveryRadiusMeters?: number;
  fixedDeliveryFeeCents?: number;
  maxDeliveryRadiusMeters?: number;
  minLeadMinutes?: number;
  isActive?: boolean;
}): Promise<Result<SatelliteLocation>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const current = await getSatelliteLocation(SLUG);
  if (!current.ok) return current;
  if (!current.data) return err('NOT_FOUND', 'Unidade não encontrada.');

  if (
    input.freeDeliveryRadiusMeters !== undefined &&
    input.maxDeliveryRadiusMeters !== undefined &&
    input.maxDeliveryRadiusMeters < input.freeDeliveryRadiusMeters
  ) {
    return err(
      'VALIDATION_ERROR',
      'O raio máximo deve ser maior ou igual ao raio grátis.',
    );
  }

  const patch: SatelliteLocationUpdate = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.addressLine !== undefined) patch.address_line = input.addressLine.trim();
  if (input.city !== undefined) patch.city = input.city.trim();
  if (input.state !== undefined) patch.state = input.state.trim().toUpperCase();
  if (input.postalCode !== undefined) patch.postal_code = input.postalCode?.trim() || null;
  if (input.latitude !== undefined) patch.latitude = input.latitude;
  if (input.longitude !== undefined) patch.longitude = input.longitude;
  if (input.freeDeliveryRadiusMeters !== undefined) {
    patch.free_delivery_radius_meters = input.freeDeliveryRadiusMeters;
  }
  if (input.fixedDeliveryFeeCents !== undefined) {
    patch.fixed_delivery_fee_cents = input.fixedDeliveryFeeCents;
  }
  if (input.maxDeliveryRadiusMeters !== undefined) {
    patch.max_delivery_radius_meters = input.maxDeliveryRadiusMeters;
  }
  if (input.minLeadMinutes !== undefined) {
    patch.min_lead_minutes = input.minLeadMinutes;
  }
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  if (Object.keys(patch).length === 0) {
    return err('VALIDATION_ERROR', 'Nenhuma alteração informada.');
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from('satellite_locations')
    .update(patch)
    .eq('id', current.data.id);

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível salvar a unidade.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'satellite_location.update',
    entityType: 'satellite_location',
    entityId: current.data.id,
    metadata: patch,
  });

  const refreshed = await getSatelliteLocation(SLUG);
  if (!refreshed.ok) return refreshed;
  if (!refreshed.data) return err('NOT_FOUND', 'Unidade não encontrada.');
  return ok(refreshed.data);
}

export async function replaceAdminSatelliteHours(
  hours: SatelliteWeekdayHour[],
): Promise<Result<SatelliteWeekdayHour[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (hours.length !== 7) {
    return err('VALIDATION_ERROR', 'Informe os 7 dias da semana.');
  }
  const weekdays = new Set(hours.map((hour) => hour.weekday));
  if (weekdays.size !== 7) {
    return err(
      'VALIDATION_ERROR',
      'Cada dia da semana deve aparecer uma vez.',
    );
  }
  for (const hour of hours) {
    if (hour.weekday < 0 || hour.weekday > 6) {
      return err('VALIDATION_ERROR', 'Dia da semana inválido.');
    }
    if (
      !hour.isClosed &&
      (!hour.pickupOpensAt ||
        !hour.pickupClosesAt ||
        hour.pickupOpensAt >= hour.pickupClosesAt)
    ) {
      return err(
        'VALIDATION_ERROR',
        'Horário inválido: abertura deve ser antes do fechamento.',
      );
    }
  }

  const current = await getSatelliteLocation(SLUG);
  if (!current.ok) return current;
  if (!current.data) return err('NOT_FOUND', 'Unidade não encontrada.');
  const locationId = current.data.id;

  const admin = createAdminSupabaseClient();
  const rows = hours.map((hour) => ({
    location_id: locationId,
    weekday: hour.weekday,
    is_closed: hour.isClosed,
    pickup_opens_at: hour.isClosed ? null : hour.pickupOpensAt,
    pickup_closes_at: hour.isClosed ? null : hour.pickupClosesAt,
    delivery_enabled: hour.deliveryEnabled,
  }));

  const { error } = await admin
    .from('satellite_location_hours')
    .upsert(rows, { onConflict: 'location_id,weekday' });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível salvar os horários.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'satellite_location.hours.update',
    entityType: 'satellite_location',
    entityId: locationId,
  });

  const { data: refreshed, error: readError } = await admin
    .from('satellite_location_hours')
    .select('*')
    .eq('location_id', locationId)
    .order('weekday', { ascending: true });

  if (readError) {
    return err('INTERNAL_ERROR', 'Não foi possível ler os horários.', {
      cause: readError,
    });
  }

  return ok((refreshed ?? []).map(mapSatelliteHour));
}

export async function replaceAdminSatelliteDeliverySlots(
  weekday: number,
  slots: Array<{
    startsAt: string;
    endsAt: string | null;
    label: string | null;
    sortOrder: number;
  }>,
): Promise<Result<SatelliteDeliverySlot[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (weekday < 0 || weekday > 6) {
    return err('VALIDATION_ERROR', 'Dia da semana inválido.');
  }
  for (const slot of slots) {
    if (!HHMM.test(slot.startsAt)) {
      return err('VALIDATION_ERROR', 'Horário inválido.');
    }
    if (slot.endsAt && (!HHMM.test(slot.endsAt) || slot.endsAt <= slot.startsAt)) {
      return err(
        'VALIDATION_ERROR',
        'O fim do horário deve ser após o início.',
      );
    }
  }

  const current = await getSatelliteLocation(SLUG);
  if (!current.ok) return current;
  if (!current.data) return err('NOT_FOUND', 'Unidade não encontrada.');
  const locationId = current.data.id;

  const admin = createAdminSupabaseClient();

  const { error: deleteError } = await admin
    .from('satellite_location_delivery_slots')
    .delete()
    .eq('location_id', locationId)
    .eq('weekday', weekday);

  if (deleteError) {
    return err(
      'INTERNAL_ERROR',
      'Não foi possível salvar os horários de entrega.',
      { cause: deleteError },
    );
  }

  if (slots.length > 0) {
    const { error: insertError } = await admin
      .from('satellite_location_delivery_slots')
      .insert(
        slots.map((slot) => ({
          location_id: locationId,
          weekday,
          starts_at: slot.startsAt,
          ends_at: slot.endsAt,
          label: slot.label,
          sort_order: slot.sortOrder,
        })),
      );
    if (insertError) {
      return err(
        'INTERNAL_ERROR',
        'Não foi possível salvar os horários de entrega.',
        { cause: insertError },
      );
    }
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'satellite_location.delivery_slots.update',
    entityType: 'satellite_location',
    entityId: locationId,
    metadata: { weekday, slotCount: slots.length },
  });

  const { data: refreshed, error: readError } = await admin
    .from('satellite_location_delivery_slots')
    .select('*')
    .eq('location_id', locationId)
    .order('weekday', { ascending: true })
    .order('sort_order', { ascending: true });

  if (readError) {
    return err(
      'INTERNAL_ERROR',
      'Não foi possível ler os horários de entrega.',
      { cause: readError },
    );
  }

  return ok((refreshed ?? []).map(mapSatelliteDeliverySlot));
}

/** Lista compacta pra dropdown de "local" no formulário de produto. */
export async function listAdminSatelliteLocations(): Promise<
  Result<Array<{ id: string; slug: string; name: string }>>
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('satellite_locations')
    .select('id, slug, name')
    .order('name', { ascending: true });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível listar as unidades.', {
      cause: error,
    });
  }
  return ok(data ?? []);
}
