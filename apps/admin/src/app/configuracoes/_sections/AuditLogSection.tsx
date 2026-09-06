'use client';

import type { AdminAuditLog } from '@/modules/admin/types';

type Props = {
  logs: AdminAuditLog[];
};

export function AuditLogSection({ logs }: Props) {
  return (
    <section className="space-y-2 rounded-lg border border-border bg-card p-3.5">
      <p className="text-sm font-semibold">Auditoria recente</p>
      {logs.map((log) => (
        <div
          key={log.id}
          className="border-t border-border py-2 first:border-t-0 first:pt-0"
        >
          <p className="text-xs font-semibold">{log.action}</p>
          <p className="text-2xs text-muted-foreground">
            {log.entityType}
            {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''} ·{' '}
            {new Date(log.createdAt).toLocaleString('pt-BR')}
          </p>
        </div>
      ))}
      {logs.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem eventos ainda.</p>
      ) : null}
    </section>
  );
}
