import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import { getPublicStore } from '@/modules/catalog/catalog-repository';
import { isCatalogStorePaused } from '@/modules/catalog/store-hours';
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
  paymentFeeEstimateBps?: number;
  acceptingOrders?: boolean;
  acceptsPix?: boolean;
  acceptsCash?: boolean;
  acceptsCard?: boolean;
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
  if (typeof input.paymentFeeEstimateBps === 'number') {
    patch.payment_fee_estimate_bps = Math.max(
      0,
      Math.min(2000, Math.round(input.paymentFeeEstimateBps)),
    );
  }
  if (typeof input.acceptingOrders === 'boolean') {
    patch.is_open_override = input.acceptingOrders ? null : false;
    if (input.acceptingOrders) {
      // Retomar aqui também levanta uma pausa com prazo que estivesse ativa.
      patch.paused_until = null;
      patch.pause_reason = null;
    }
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
  if (accepting) return resumeStore();
  return pauseStore({ pausedUntil: null, reason: null });
}

type StorePauseState = {
  acceptingOrders: boolean;
  pausedUntil: string | null;
  pauseReason: string | null;
};

function pauseState(store: CatalogStore): StorePauseState {
  const paused = isCatalogStorePaused(store) || store.isOpenOverride === false;
  return {
    acceptingOrders: !paused,
    pausedUntil: store.pausedUntil,
    pauseReason: store.pauseReason,
  };
}

export async function getStoreAcceptingOrders(): Promise<
  Result<StorePauseState>
> {
  const store = await getAdminStore();
  if (!store.ok) return store;
  if (!store.data) return err('NOT_FOUND', 'Loja não encontrada.');
  return ok(pauseState(store.data));
}

/**
 * Pausa a loja. `pausedUntil` nulo = pausa sem previsão (`is_open_override =
 * false`); com data = pausa com prazo, que se retoma sozinha quando o
 * instante passa (a regra de "loja aberta" checa `paused_until`).
 */
export async function pauseStore(input: {
  pausedUntil: string | null;
  reason: string | null;
}): Promise<Result<StorePauseState>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const current = await getPublicStore();
  if (!current.ok) return current;
  if (!current.data) return err('NOT_FOUND', 'Loja não encontrada.');

  let until: string | null = null;
  if (input.pausedUntil) {
    const parsed = new Date(input.pausedUntil);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      return err('VALIDATION_ERROR', 'A pausa precisa terminar no futuro.');
    }
    until = parsed.toISOString();
  }

  const reason = input.reason?.trim() || null;
  const patch: StoreUpdate = {
    paused_until: until,
    pause_reason: reason,
    is_open_override: until ? null : false,
  };

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from('stores')
    .update(patch)
    .eq('id', current.data.id);
  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível pausar a loja.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'store.pause',
    entityType: 'store',
    entityId: current.data.id,
    metadata: { pausedUntil: until, reason },
  });

  const refreshed = await getPublicStore();
  if (!refreshed.ok) return refreshed;
  if (!refreshed.data) return err('NOT_FOUND', 'Loja não encontrada.');
  return ok(pauseState(refreshed.data));
}

export async function resumeStore(): Promise<Result<StorePauseState>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const current = await getPublicStore();
  if (!current.ok) return current;
  if (!current.data) return err('NOT_FOUND', 'Loja não encontrada.');

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from('stores')
    .update({ paused_until: null, pause_reason: null, is_open_override: null })
    .eq('id', current.data.id);
  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível retomar a loja.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'store.resume',
    entityType: 'store',
    entityId: current.data.id,
  });

  const refreshed = await getPublicStore();
  if (!refreshed.ok) return refreshed;
  if (!refreshed.data) return err('NOT_FOUND', 'Loja não encontrada.');
  return ok(pauseState(refreshed.data));
}
