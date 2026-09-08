'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import type { AdminAuditLog } from '@/modules/admin/types';
import { cn } from '@/lib/cn';

const AREAS: Array<{ id: string; label: string }> = [
  { id: '', label: 'Tudo' },
  { id: 'product', label: 'Produtos' },
  { id: 'category', label: 'Categorias' },
  { id: 'store', label: 'Loja' },
  { id: 'order', label: 'Pedidos' },
  { id: 'promotion', label: 'Promoções' },
];

const PERIODS: Array<{ days: number; label: string }> = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
];

/** Um resumo curto do metadata do evento (o que mudou), sem despejar o JSON. */
function describe(log: AdminAuditLog): string | null {
  const meta = log.metadata;
  if (!meta) return null;
  if (typeof meta.name === 'string') return meta.name;
  if (typeof meta.reason === 'string') return meta.reason;
  if (typeof meta.count === 'number') return `${meta.count} itens`;
  if (typeof meta.pausedUntil === 'string') {
    return `até ${new Date(meta.pausedUntil).toLocaleString('pt-BR')}`;
  }
  const keys = Object.keys(meta);
  return keys.length ? keys.slice(0, 4).join(', ') : null;
}

export function AuditLogSection() {
  const [area, setArea] = useState('');
  const [days, setDays] = useState(30);

  const query = useQuery({
    queryKey: [...adminKeys.audit(), area, days],
    queryFn: () =>
      apiJson<{ logs: AdminAuditLog[] }>(
        `/api/v1/admin/audit-logs?limit=200&days=${days}${area ? `&action=${area}` : ''}`,
      ),
  });

  const logs = query.data?.logs ?? [];

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-3.5">
      <p className="text-sm font-semibold">Auditoria</p>

      <div className="flex flex-wrap gap-1.5">
        {AREAS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setArea(item.id)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-2xs font-semibold transition-colors',
              area === item.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-accent',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        {PERIODS.map((item) => (
          <button
            key={item.days}
            type="button"
            onClick={() => setDays(item.days)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-2xs font-semibold transition-colors',
              days === item.days
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-accent',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Nenhum evento nesse filtro.
        </p>
      ) : (
        <ul className="max-h-[420px] space-y-0 overflow-y-auto">
          {logs.map((log) => {
            const detail = describe(log);
            return (
              <li
                key={log.id}
                className="border-t border-border py-2 first:border-t-0 first:pt-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold">{log.action}</p>
                  <p className="shrink-0 text-2xs tabular-nums text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                {detail ? (
                  <p className="mt-0.5 truncate text-2xs text-muted-foreground">
                    {detail}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
