import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import { getPublicStore } from '@/modules/catalog/catalog-repository';
import { isHhmm } from '@/modules/scheduling/slot-times';
import type { CatalogStore } from '@/modules/catalog/types';
import type { Database } from '@/types/database';

type StoreUpdate = Database['public']['Tables']['stores']['Update'];

export async function getAdminStore(): Promise<Result<CatalogStore | null>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  return getPublicStore();
}

export async function updateAdminStore(input: {
  name?: string;
  cnpj?: string | null;
  phoneE164?: string;
  whatsappE164?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  postalCode?: string | null;
  latitude?: number;
  longitude?: number;
  freeDeliveryRadiusMeters?: number;
  fixedDeliveryFeeCents?: number;
  maxDeliveryRadiusMeters?: number;
  acceptingOrders?: boolean;
  acceptsPix?: boolean;
  acceptsCash?: boolean;
  acceptsCard?: boolean;
  scheduleSlotTimes?: string[];
}): Promise<Result<CatalogStore>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const current = await getPublicStore();
  if (!current.ok) return current;
  if (!current.data) return err('NOT_FOUND', 'Loja não encontrada.');

  const nextPayments = {
    pix:
      typeof input.acceptsPix === 'boolean'
        ? input.acceptsPix
        : current.data.acceptsPayments.pix,
    cash:
      typeof input.acceptsCash === 'boolean'
        ? input.acceptsCash
        : current.data.acceptsPayments.cash,
    card:
      typeof input.acceptsCard === 'boolean'
        ? input.acceptsCard
        : current.data.acceptsPayments.card,
  };
  if (!nextPayments.pix && !nextPayments.cash && !nextPayments.card) {
    return err(
      'VALIDATION_ERROR',
      'Mantenha ao menos uma forma de pagamento habilitada.',
    );
  }

  const nextFreeRadius =
    input.freeDeliveryRadiusMeters ?? current.data.freeDeliveryRadiusMeters;
  const nextMaxRadius =
    input.maxDeliveryRadiusMeters ?? current.data.maxDeliveryRadiusMeters;
  if (nextMaxRadius < nextFreeRadius) {
    return err(
      'VALIDATION_ERROR',
      'O raio máximo de entrega deve ser maior ou igual ao raio grátis.',
    );
  }

  const patch: StoreUpdate = {};
  if (typeof input.name === 'string') patch.name = input.name.trim();
  if (input.cnpj !== undefined) {
    patch.cnpj = input.cnpj?.trim() || null;
  }
  if (typeof input.phoneE164 === 'string') {
    patch.phone_e164 = input.phoneE164.trim();
  }
  if (typeof input.whatsappE164 === 'string') {
    patch.whatsapp_e164 = input.whatsappE164.trim();
  }
  if (typeof input.addressLine === 'string') {
    patch.address_line = input.addressLine.trim();
  }
  if (typeof input.city === 'string') patch.city = input.city.trim();
  if (typeof input.state === 'string') patch.state = input.state.trim();
  if (input.postalCode !== undefined) {
    patch.postal_code = input.postalCode?.trim() || null;
  }
  if (typeof input.latitude === 'number') patch.latitude = input.latitude;
  if (typeof input.longitude === 'number') patch.longitude = input.longitude;
  if (typeof input.freeDeliveryRadiusMeters === 'number') {
    patch.free_delivery_radius_meters = input.freeDeliveryRadiusMeters;
  }
  if (typeof input.fixedDeliveryFeeCents === 'number') {
    patch.fixed_delivery_fee_cents = input.fixedDeliveryFeeCents;
  }
  if (typeof input.maxDeliveryRadiusMeters === 'number') {
    patch.max_delivery_radius_meters = input.maxDeliveryRadiusMeters;
  }
  if (typeof input.acceptingOrders === 'boolean') {
    patch.is_open_override = input.acceptingOrders ? null : false;
  }
  if (typeof input.acceptsPix === 'boolean') {
    patch.accepts_pix = input.acceptsPix;
  }
  if (typeof input.acceptsCash === 'boolean') {
    patch.accepts_cash = input.acceptsCash;
  }
  if (typeof input.acceptsCard === 'boolean') {
    patch.accepts_card = input.acceptsCard;
  }
  if (input.scheduleSlotTimes !== undefined) {
    const cleaned = Array.from(
      new Set(input.scheduleSlotTimes.filter((time) => isHhmm(time))),
    ).sort();
    if (cleaned.length === 0) {
      return err(
        'VALIDATION_ERROR',
        'Informe ao menos um horário de agendamento válido (HH:MM).',
      );
    }
    patch.schedule_slot_times = cleaned;
  }

  if (Object.keys(patch).length === 0) {
    return err('VALIDATION_ERROR', 'Nenhuma alteração informada.');
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from('stores')
    .update(patch)
    .eq('id', current.data.id);

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível atualizar a loja.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'store.update',
    entityType: 'store',
    entityId: current.data.id,
    metadata: patch,
  });

  const refreshed = await getPublicStore();
  if (!refreshed.ok) return refreshed;
  if (!refreshed.data) return err('NOT_FOUND', 'Loja não encontrada.');
  return ok(refreshed.data);
}

export async function setStoreAcceptingOrders(
  accepting: boolean,
): Promise<Result<{ acceptingOrders: boolean }>> {
  const result = await updateAdminStore({ acceptingOrders: accepting });
  if (!result.ok) return result;
  return ok({ acceptingOrders: accepting });
}

export async function getStoreAcceptingOrders(): Promise<
  Result<{ acceptingOrders: boolean }>
> {
  const store = await getAdminStore();
  if (!store.ok) return store;
  if (!store.data) return err('NOT_FOUND', 'Loja não encontrada.');
  return ok({
    acceptingOrders: store.data.isOpenOverride !== false,
  });
}
