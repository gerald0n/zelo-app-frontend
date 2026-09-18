import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requirePlatformAdmin } from '@/modules/gestor/auth';
import type { Database } from '@/types/database';

type StoreRow = Database['public']['Tables']['stores']['Row'];
type StoreInsert = Database['public']['Tables']['stores']['Insert'];
type StoreUpdate = Database['public']['Tables']['stores']['Update'];

export type GestorStore = {
  id: string;
  name: string;
  domain: string | null;
  city: string;
  state: string;
  phoneE164: string;
  createdAt: string;
};

function toGestorStore(row: StoreRow): GestorStore {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    city: row.city,
    state: row.state,
    phoneE164: row.phone_e164,
    createdAt: row.created_at,
  };
}

export async function listStores(): Promise<Result<GestorStore[]>> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('stores')
    .select('id, name, domain, city, state, phone_e164, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível listar as lojas.', {
      cause: error,
    });
  }

  return ok((data ?? []).map((row) => toGestorStore(row as StoreRow)));
}

export type StoreDetail = StoreRow;

export async function getStore(id: string): Promise<Result<StoreDetail>> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('stores')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar a loja.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Loja não encontrada.');

  return ok(data);
}

export type CreateStoreInput = {
  name: string;
  domain?: string | null;
  phoneE164: string;
  whatsappE164: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode?: string | null;
  latitude: number;
  longitude: number;
  timezone?: string;
};

/**
 * Provisionamento manual de tenant — versão mínima do step 1 do wizard
 * desenhado na Fase E do ADR-0001 (só nome/domínio/endereço; tema, feature
 * flags e integrações ficam para quando essas fatias existirem). Domínio
 * de tenant próprio ainda depende de DNS configurado manualmente pelo
 * cliente — aqui só grava o valor, não provisiona nada na Vercel.
 */
export async function createStore(
  input: CreateStoreInput,
): Promise<Result<GestorStore>> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;

  const name = input.name.trim();
  if (!name) return err('VALIDATION_ERROR', 'Informe o nome da loja.');

  const addressLine = input.addressLine.trim();
  const city = input.city.trim();
  const state = input.state.trim();
  if (!addressLine || !city || !state) {
    return err('VALIDATION_ERROR', 'Informe o endereço completo.');
  }

  const phoneE164 = input.phoneE164.trim();
  const whatsappE164 = input.whatsappE164.trim();
  if (!/^\+\d{10,15}$/.test(phoneE164) || !/^\+\d{10,15}$/.test(whatsappE164)) {
    return err(
      'VALIDATION_ERROR',
      'Telefone e WhatsApp precisam estar em E.164 (ex.: +5588999999999).',
    );
  }

  if (
    !Number.isFinite(input.latitude) ||
    !Number.isFinite(input.longitude) ||
    (input.latitude === 0 && input.longitude === 0)
  ) {
    return err(
      'VALIDATION_ERROR',
      'Informe latitude/longitude reais (pin no Google Maps).',
    );
  }

  const domain = input.domain?.trim() || null;

  const admin = createAdminSupabaseClient();

  if (domain) {
    const { data: existing } = await admin
      .from('stores')
      .select('id')
      .eq('domain', domain)
      .maybeSingle();
    if (existing) {
      return err('VALIDATION_ERROR', 'Esse domínio já está em uso por outra loja.');
    }
  }

  const patch: StoreInsert = {
    name,
    domain,
    phone_e164: phoneE164,
    whatsapp_e164: whatsappE164,
    address_line: addressLine,
    city,
    state,
    postal_code: input.postalCode?.trim() || null,
    latitude: input.latitude,
    longitude: input.longitude,
    timezone: input.timezone?.trim() || 'America/Sao_Paulo',
  };

  const { data, error } = await admin
    .from('stores')
    .insert(patch)
    .select('id, name, domain, city, state, phone_e164, created_at')
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível criar a loja.', {
      cause: error,
    });
  }

  await writeGestorAuditLog({
    actorId: auth.data.id,
    action: 'store.create',
    entityId: data.id,
    metadata: { name, domain },
  });

  return ok(toGestorStore(data as StoreRow));
}

export type UpdateStoreInput = {
  name?: string;
  domain?: string | null;
  phoneE164?: string;
  whatsappE164?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  postalCode?: string | null;
};

export async function updateStore(
  id: string,
  input: UpdateStoreInput,
): Promise<Result<StoreDetail>> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();

  const patch: StoreUpdate = {};
  if (typeof input.name === 'string') {
    const name = input.name.trim();
    if (!name) return err('VALIDATION_ERROR', 'Informe o nome da loja.');
    patch.name = name;
  }
  if (input.domain !== undefined) {
    const domain = input.domain?.trim() || null;
    if (domain) {
      const { data: existing } = await admin
        .from('stores')
        .select('id')
        .eq('domain', domain)
        .neq('id', id)
        .maybeSingle();
      if (existing) {
        return err(
          'VALIDATION_ERROR',
          'Esse domínio já está em uso por outra loja.',
        );
      }
    }
    patch.domain = domain;
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

  if (Object.keys(patch).length === 0) {
    return err('VALIDATION_ERROR', 'Nenhuma alteração informada.');
  }

  const { data, error } = await admin
    .from('stores')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível atualizar a loja.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Loja não encontrada.');

  await writeGestorAuditLog({
    actorId: auth.data.id,
    action: 'store.update',
    entityId: id,
    metadata: patch,
  });

  return ok(data);
}

/**
 * Log de auditoria próprio do gestor — mesma tabela `audit_logs` global do
 * admin (sem `store_id`, é uma tabela cross-tenant), mas sem o efeito
 * colateral de invalidar cache de catálogo (`modules/admin/audit.ts`): uma
 * mutação de `stores` feita aqui é o cadastro do tenant, não uma mudança de
 * catálogo de um tenant já existente.
 */
async function writeGestorAuditLog(options: {
  actorId: string;
  action: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  await admin.from('audit_logs').insert({
    actor_type: 'admin',
    actor_id: options.actorId,
    action: options.action,
    entity_type: 'store',
    entity_id: options.entityId ?? null,
    metadata: (options.metadata ?? null) as Database['public']['Tables']['audit_logs']['Insert']['metadata'],
  });
}
