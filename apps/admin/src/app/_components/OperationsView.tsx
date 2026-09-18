'use client';

import { useQuery } from '@tanstack/react-query';
import { Ban, ChefHat, Loader2 } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type { OperationsReport, ReportRange } from '@/modules/admin/reports';
import { ReportBar } from '@/app/_components/ReportBar';

function formatCancelledAt(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OperationsView({
  range,
  onSelectOrder,
}: {
  range: ReportRange;
  onSelectOrder: (orderId: string) => void;
}) {
  const query = useQuery({
    // Realtime invalida via `AdminRealtimeProvider` — fora do queryKey.
    queryKey: adminKeys.reports(`op-${range.from}-${range.to}`),
    queryFn: () =>
      apiJson<OperationsReport>(
        `/api/v1/admin/reports?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      ),
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
        {data.cancellations.recent.length > 0 ? (
          <div className="space-y-1 border-t border-border pt-2">
            {data.cancellations.recent.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => onSelectOrder(order.id)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left text-2xs transition-colors hover:bg-muted"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-bold text-foreground">
                    #{order.orderNumber}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    {order.reason}
                  </span>
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {formatCatalogPrice(order.totalCents)} ·{' '}
                  {formatCancelledAt(order.cancelledAt)}
                </span>
              </button>
            ))}
          </div>
        ) : null}
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
