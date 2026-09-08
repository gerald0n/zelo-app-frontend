'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Ban, ChefHat } from 'lucide-react';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAdminRealtime } from '@/contexts/AdminRealtimeContext';
import { apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { adminContainerClass } from '@/lib/layout';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type { OperationsReport, ReportPeriod } from '@/modules/admin/reports';
import { cn } from '@/lib/cn';

const PERIODS: Array<{ id: ReportPeriod; label: string }> = [
  { id: 'today', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
];

/** Barra proporcional simples (sem lib de gráfico). */
function Row({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  return (
    <div className="space-y-1 border-t border-border py-2 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="min-w-0 truncate font-medium">{label}</span>
        <span className="shrink-0 font-bold tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/70"
          style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

export default function AdminRelatoriosPage() {
  const { ready, isAuthenticated } = useRequireAdmin();
  const { version } = useAdminRealtime();
  const [period, setPeriod] = useState<ReportPeriod>('today');

  const query = useQuery({
    queryKey: [...adminKeys.reports(period), version],
    enabled: ready && isAuthenticated,
    queryFn: () =>
      apiJson<OperationsReport>(`/api/v1/admin/reports?period=${period}`),
  });

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const data = query.data;
  const topCancel = data?.cancellations.byReason[0]?.count ?? 0;
  const topProd = data?.production.items[0]?.quantity ?? 0;

  return (
    <div
      className={cn(
        'min-h-dvh space-y-4 p-3.5 pb-24 md:px-6 md:pt-6',
        adminContainerClass,
      )}
    >
      <header>
        <p className="text-2xs font-bold uppercase tracking-widest text-primary">
          Operação
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">
          Relatórios
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Cancelamentos e produção. Faturamento e ticket médio ficam na Visão
          geral.
        </p>
      </header>

      <div className="flex gap-1.5">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPeriod(item.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-2xs font-semibold transition-colors',
              period === item.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:bg-accent',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {query.isLoading || !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-2 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Ban className="size-4 text-destructive" />
              <h2 className="font-serif text-base font-bold">Cancelamentos</h2>
            </div>
            <p className="text-2xs text-muted-foreground">
              <span className="font-bold text-foreground">
                {data.cancellations.total}
              </span>{' '}
              pedido{data.cancellations.total === 1 ? '' : 's'} ·{' '}
              {formatCatalogPrice(data.cancellations.valueCents)} não faturados
            </p>
            <div className="pt-1">
              {data.cancellations.byReason.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Nenhum cancelamento no período.
                </p>
              ) : (
                data.cancellations.byReason.map((entry) => (
                  <Row
                    key={entry.reason}
                    label={entry.reason}
                    value={entry.count}
                    max={topCancel}
                  />
                ))
              )}
            </div>
          </section>

          <section className="space-y-2 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <ChefHat className="size-4 text-primary" />
              <h2 className="font-serif text-base font-bold">Produção</h2>
            </div>
            <p className="text-2xs text-muted-foreground">
              <span className="font-bold text-foreground">
                {data.production.totalItems}
              </span>{' '}
              itens em {data.production.items.length} produtos
            </p>
            <div className="pt-1">
              {data.production.items.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Nenhum item no período.
                </p>
              ) : (
                data.production.items.map((item) => (
                  <Row
                    key={item.name}
                    label={item.name}
                    value={item.quantity}
                    max={topProd}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
