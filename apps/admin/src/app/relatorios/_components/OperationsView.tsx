'use client';

import { useQuery } from '@tanstack/react-query';
import { Ban, ChefHat, Loader2 } from 'lucide-react';
import { useAdminRealtime } from '@/contexts/AdminRealtimeContext';
import { apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type { OperationsReport, ReportPeriod } from '@/modules/admin/reports';
import { ReportBar } from '@/app/relatorios/_components/ReportBar';

export function OperationsView({ period }: { period: ReportPeriod }) {
  const { version } = useAdminRealtime();
  const query = useQuery({
    queryKey: [...adminKeys.reports(`op-${period}`), version],
    queryFn: () =>
      apiJson<OperationsReport>(`/api/v1/admin/reports?period=${period}`),
  });

  const data = query.data;
  if (query.isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const topCancel = data.cancellations.byReason[0]?.count ?? 0;
  const topProd = data.production.items[0]?.quantity ?? 0;

  return (
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
              <ReportBar
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
              <ReportBar
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
  );
}
