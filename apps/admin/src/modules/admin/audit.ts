import 'server-only';

import { after } from 'next/server';
import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/modules/admin/auth';
import {
  catalogTagsForAuditAction,
  requestCatalogRevalidation,
} from '@/modules/catalog/revalidate';
import type { AdminAuditLog } from '@/modules/admin/types';
import type { Json } from '@/types/database';

export async function writeAuditLog(options: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  await admin.from('audit_logs').insert({
    actor_type: 'admin',
    actor_id: options.actorId,
    action: options.action,
    entity_type: options.entityType,
    entity_id: options.entityId ?? null,
    metadata: (options.metadata ?? null) as Json | null,
  });

  // Toda mutação do catálogo/loja passa por aqui — invalida o cache do
  // `apps/client` depois da resposta, sem somar latência à mutação.
  const tags = catalogTagsForAuditAction(options.action);
  if (tags.length > 0) {
    after(() => requestCatalogRevalidation(tags));
  }
}

export async function listAdminAuditLogs(options?: {
  limit?: number;
  /** Filtra por prefixo de ação (ex.: "product" pega "product.create" etc). */
  actionPrefix?: string;
  /** ISO — só eventos a partir daqui. */
  since?: string;
}): Promise<Result<AdminAuditLog[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  let query = admin
    .from('audit_logs')
    .select(
      'id, action, entity_type, entity_id, metadata, created_at, actor_type, actor_id',
    )
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 40);

  if (options?.actionPrefix) {
    query = query.like('action', `${options.actionPrefix}%`);
  }
  if (options?.since) {
    query = query.gte('created_at', options.since);
  }

  const { data, error } = await query;

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar a auditoria.', {
      cause: error,
    });
  }

  const rows = data ?? [];

  // Resolve o nome de cada admin que originou um evento (não há FK declarada
  // para o PostgREST embutir, então busca em lote pelos ids únicos).
  const adminIds = Array.from(
    new Set(
      rows
        .filter((row) => row.actor_type === 'admin' && row.actor_id)
        .map((row) => row.actor_id as string),
    ),
  );
  const namesById = new Map<string, string>();
  if (adminIds.length > 0) {
    const { data: profiles } = await admin
      .from('admin_profiles')
      .select('id, display_name')
      .in('id', adminIds);
    for (const profile of profiles ?? []) {
      namesById.set(profile.id, profile.display_name);
    }
  }

  return ok(
    rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      createdAt: row.created_at,
      actorType: row.actor_type,
      actorName:
        row.actor_type === 'admin' && row.actor_id
          ? (namesById.get(row.actor_id) ?? null)
          : null,
      metadata:
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : null,
    })),
  );
}
