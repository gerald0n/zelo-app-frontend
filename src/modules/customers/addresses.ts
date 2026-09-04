import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getPublicStore } from '@/modules/catalog/catalog-repository';
import {
  quoteDelivery,
  type DeliveryAddressInput,
} from '@/modules/delivery';
import {
  ensureCustomerRecord,
  resolveCustomerForCheckout,
} from '@/modules/orders/customer';

export type SavedAddress = {
  id: string;
  label: string | null;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string | null;
  complement: string | null;
  referencePoint: string | null;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  lastUsedAt: string | null;
};

export type SavedAddressInput = DeliveryAddressInput & {
  label?: string;
  isDefault?: boolean;
};

function mapRow(row: {
  id: string;
  label: string | null;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string | null;
  complement: string | null;
  reference_point: string | null;
  latitude: number | string;
  longitude: number | string;
  is_default: boolean;
  last_used_at: string | null;
}): SavedAddress {
  return {
    id: row.id,
    label: row.label,
    street: row.street,
    number: row.number,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    complement: row.complement,
    referencePoint: row.reference_point,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    isDefault: row.is_default,
    lastUsedAt: row.last_used_at,
  };
}

const SELECT_COLUMNS =
  'id, label, street, number, neighborhood, city, state, postal_code, complement, reference_point, latitude, longitude, is_default, last_used_at';

async function requireCustomerId(): Promise<Result<string>> {
  const identity = await resolveCustomerForCheckout();
  if (!identity.ok) return identity;
  const ensured = await ensureCustomerRecord(identity.data);
  if (!ensured.ok) return ensured;
  return ok(ensured.data.id);
}

async function resolveQuotedCoords(
  input: SavedAddressInput,
): Promise<
  Result<{
    latitude: number;
    longitude: number;
    city: string;
    state: string;
    postalCode?: string;
  }>
> {
  const storeResult = await getPublicStore();
  if (!storeResult.ok) return storeResult;
  if (!storeResult.data) {
    return err('NOT_FOUND', 'Loja não encontrada.');
  }

  const store = storeResult.data;
  const quote = await quoteDelivery(input, {
    latitude: store.latitude,
    longitude: store.longitude,
    freeDeliveryRadiusMeters: store.freeDeliveryRadiusMeters,
    fixedDeliveryFeeCents: store.fixedDeliveryFeeCents,
    maxDeliveryRadiusMeters: store.maxDeliveryRadiusMeters,
    addressLine: store.addressLine,
    city: store.city,
    state: store.state,
  });
  if (!quote.ok) return quote;
  if (!quote.data.inServiceArea) {
    return err(
      'OUT_OF_DELIVERY_AREA',
      quote.data.message ??
        'Endereço fora da área urbana de Pereiro.',
    );
  }

  return ok({
    latitude: quote.data.latitude,
    longitude: quote.data.longitude,
    city: input.city?.trim() || store.city,
    state: input.state?.trim() || store.state,
    postalCode: input.postalCode?.trim() || undefined,
  });
}

async function clearDefault(customerId: string): Promise<Result<true>> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from('customer_addresses')
    .update({ is_default: false })
    .eq('customer_id', customerId)
    .eq('is_default', true)
    .is('archived_at', null);

  if (error) {
    logger.error('Falha ao limpar endereço padrão', { message: error.message });
    return err('INTERNAL_ERROR', 'Não foi possível atualizar o endereço.', {
      cause: error,
    });
  }
  return ok(true);
}

export async function listSavedAddresses(): Promise<Result<SavedAddress[]>> {
  const customerId = await requireCustomerId();
  if (!customerId.ok) return customerId;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('customer_addresses')
    .select(SELECT_COLUMNS)
    .eq('customer_id', customerId.data)
    .is('archived_at', null)
    .order('is_default', { ascending: false })
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Falha ao listar endereços', { message: error.message });
    return err('INTERNAL_ERROR', 'Não foi possível carregar os endereços.', {
      cause: error,
    });
  }

  return ok((data ?? []).map(mapRow));
}

export async function createSavedAddress(
  input: SavedAddressInput,
): Promise<Result<SavedAddress>> {
  const customerId = await requireCustomerId();
  if (!customerId.ok) return customerId;

  const quoted = await resolveQuotedCoords(input);
  if (!quoted.ok) return quoted;

  const admin = createAdminSupabaseClient();
  const { count } = await admin
    .from('customer_addresses')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId.data)
    .is('archived_at', null);

  const makeDefault = Boolean(input.isDefault) || (count ?? 0) === 0;

  if (makeDefault) {
    const cleared = await clearDefault(customerId.data);
    if (!cleared.ok) return cleared;
  }

  const { data, error } = await admin
    .from('customer_addresses')
    .insert({
      customer_id: customerId.data,
      label: input.label?.trim() || null,
      street: input.street.trim(),
      number: input.number.trim(),
      neighborhood: input.neighborhood?.trim() ?? '',
      city: quoted.data.city,
      state: quoted.data.state,
      postal_code: quoted.data.postalCode ?? null,
      complement: input.complement?.trim() || null,
      reference_point: input.referencePoint?.trim() || null,
      latitude: quoted.data.latitude,
      longitude: quoted.data.longitude,
      is_default: makeDefault,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    logger.error('Falha ao salvar endereço', { message: error?.message });
    return err('INTERNAL_ERROR', 'Não foi possível salvar o endereço.', {
      cause: error,
    });
  }

  return ok(mapRow(data));
}

export async function updateSavedAddress(
  addressId: string,
  input: SavedAddressInput,
): Promise<Result<SavedAddress>> {
  const customerId = await requireCustomerId();
  if (!customerId.ok) return customerId;

  const quoted = await resolveQuotedCoords(input);
  if (!quoted.ok) return quoted;

  if (input.isDefault) {
    const cleared = await clearDefault(customerId.data);
    if (!cleared.ok) return cleared;
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('customer_addresses')
    .update({
      label: input.label?.trim() || null,
      street: input.street.trim(),
      number: input.number.trim(),
      neighborhood: input.neighborhood?.trim() ?? '',
      city: quoted.data.city,
      state: quoted.data.state,
      postal_code: quoted.data.postalCode ?? null,
      complement: input.complement?.trim() || null,
      reference_point: input.referencePoint?.trim() || null,
      latitude: quoted.data.latitude,
      longitude: quoted.data.longitude,
      is_default: Boolean(input.isDefault),
    })
    .eq('id', addressId)
    .eq('customer_id', customerId.data)
    .is('archived_at', null)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    logger.error('Falha ao atualizar endereço', { message: error.message });
    return err('INTERNAL_ERROR', 'Não foi possível atualizar o endereço.', {
      cause: error,
    });
  }
  if (!data) {
    return err('NOT_FOUND', 'Endereço não encontrado.');
  }

  return ok(mapRow(data));
}

export async function archiveSavedAddress(
  addressId: string,
): Promise<Result<{ archived: true }>> {
  const customerId = await requireCustomerId();
  if (!customerId.ok) return customerId;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('customer_addresses')
    .update({
      archived_at: new Date().toISOString(),
      is_default: false,
    })
    .eq('id', addressId)
    .eq('customer_id', customerId.data)
    .is('archived_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    logger.error('Falha ao remover endereço', { message: error.message });
    return err('INTERNAL_ERROR', 'Não foi possível remover o endereço.', {
      cause: error,
    });
  }
  if (!data) {
    return err('NOT_FOUND', 'Endereço não encontrado.');
  }

  return ok({ archived: true });
}

export async function markSavedAddressUsed(
  addressId: string,
): Promise<void> {
  const customerId = await requireCustomerId();
  if (!customerId.ok) return;

  const admin = createAdminSupabaseClient();
  await admin
    .from('customer_addresses')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', addressId)
    .eq('customer_id', customerId.data);
}
