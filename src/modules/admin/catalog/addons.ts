import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import type { AdminAddon } from '@/modules/admin/types';
import type { Database } from '@/types/database';

type AddonUpdate = Database['public']['Tables']['add_ons']['Update'];

export async function listAdminAddons(): Promise<Result<AdminAddon[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('add_ons')
    .select(
      'id, name, description, price_cents, is_active, is_available, archived_at',
    )
    .is('archived_at', null)
    .order('name', { ascending: true });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar adicionais.', {
      cause: error,
    });
  }

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      priceCents: row.price_cents,
      isActive: row.is_active,
      isAvailable: row.is_available,
    })),
  );
}

export async function createAdminAddon(input: {
  name: string;
  description?: string | null;
  priceCents: number;
  isActive?: boolean;
  isAvailable?: boolean;
}): Promise<Result<AdminAddon>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('add_ons')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      price_cents: input.priceCents,
      is_active: input.isActive ?? true,
      is_available: input.isAvailable ?? true,
    })
    .select('id, name, description, price_cents, is_active, is_available')
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível criar o adicional.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'addon.create',
    entityType: 'addon',
    entityId: data.id,
    metadata: { name: data.name, priceCents: data.price_cents },
  });

  return ok({
    id: data.id,
    name: data.name,
    description: data.description,
    priceCents: data.price_cents,
    isActive: data.is_active,
    isAvailable: data.is_available,
  });
}

export async function updateAdminAddon(options: {
  addonId: string;
  name?: string;
  description?: string | null;
  priceCents?: number;
  isActive?: boolean;
  isAvailable?: boolean;
}): Promise<Result<AdminAddon>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const patch: AddonUpdate = {};
  if (typeof options.name === 'string') patch.name = options.name.trim();
  if (options.description !== undefined) {
    patch.description = options.description?.trim() || null;
  }
  if (typeof options.priceCents === 'number') {
    patch.price_cents = options.priceCents;
  }
  if (typeof options.isActive === 'boolean') patch.is_active = options.isActive;
  if (typeof options.isAvailable === 'boolean') {
    patch.is_available = options.isAvailable;
  }

  if (Object.keys(patch).length === 0) {
    return err('VALIDATION_ERROR', 'Nenhuma alteração informada.');
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('add_ons')
    .update(patch)
    .eq('id', options.addonId)
    .is('archived_at', null)
    .select('id, name, description, price_cents, is_active, is_available')
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível atualizar o adicional.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Adicional não encontrado.');

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'addon.update',
    entityType: 'addon',
    entityId: data.id,
    metadata: patch,
  });

  return ok({
    id: data.id,
    name: data.name,
    description: data.description,
    priceCents: data.price_cents,
    isActive: data.is_active,
    isAvailable: data.is_available,
  });
}

export async function archiveAdminAddon(addonId: string): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('add_ons')
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq('id', addonId)
    .is('archived_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível arquivar o adicional.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Adicional não encontrado.');

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'addon.archive',
    entityType: 'addon',
    entityId: addonId,
  });

  return ok(true);
}
