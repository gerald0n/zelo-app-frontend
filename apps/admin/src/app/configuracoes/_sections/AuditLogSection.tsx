'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import type { AdminAuditLog } from '@/modules/admin/types';
import { cn } from '@/lib/cn';
import {
  actionLabel,
  auditDetail,
} from '@/app/configuracoes/_sections/audit-log-labels';

const AREAS: Array<{ id: string; label: string }> = [
  { id: '', label: 'Tudo' },
  { id: 'product', label: 'Produtos' },
  { id: 'category', label: 'Categorias' },
  { id: 'addon', label: 'Adicionais' },
  { id: 'promotion', label: 'Promoções' },
  { id: 'coupon', label: 'Cupons' },
  { id: 'store', label: 'Loja' },
  { id: 'review', label: 'Avaliações' },
  { id: 'notification', label: 'Notificações' },
];

const PERIODS: Array<{ days: number; label: string }> = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
];

function actorLabel(log: AdminAuditLog): string {
  if (log.actorType === 'admin') return log.actorName ?? 'Equipe';
  if (log.actorType === 'customer') return 'Cliente';
  if (log.actorType === 'system') return 'Sistema';
  return log.actorType;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
      <div>
        <p className="text-sm font-semibold">Auditoria</p>
        <p className="mt-0.5 text-2xs text-muted-foreground">
          Tudo o que a equipe alterou no catálogo e nas configurações, com quem
          fez e quando.
        </p>
      </div>

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
        <ul className="max-h-[460px] space-y-0 overflow-y-auto">
          {logs.map((log) => {
            const detail = auditDetail(log);
            return (
              <li
                key={log.id}
                className="border-t border-border py-2.5 first:border-t-0 first:pt-0"
              >
                <p className="text-xs font-semibold text-foreground">
                  {actionLabel(log.action)}
                </p>
                {detail ? (
                  <p className="mt-0.5 text-2xs text-muted-foreground">
                    {detail}
                  </p>
                ) : null}
                <p className="mt-1 text-2xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">
                    {actorLabel(log)}
                  </span>
                  {' · '}
                  {formatWhen(log.createdAt)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
