import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/modules/admin/auth';
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
}

export async function listAdminAuditLogs(
  limit = 40,
): Promise<Result<AdminAuditLog[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar a auditoria.', {
      cause: error,
    });
  }

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      createdAt: row.created_at,
      metadata:
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : null,
    })),
  );
}
