'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, RotateCcw, Wallet } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type { ReportPeriod } from '@/modules/admin/reports';
import type { FinancialReport } from '@/modules/admin/financial-report';

const METHOD_LABEL = { pix: 'Pix', cash: 'Dinheiro', card: 'Cartão' } as const;

function Line({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'muted' | 'strong' | 'negative';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          tone === 'strong'
            ? 'font-bold tabular-nums'
            : tone === 'negative'
              ? 'font-medium tabular-nums text-destructive'
              : 'font-medium tabular-nums'
        }
      >
        {value}
      </span>
    </div>
  );
}

export function FinancialView({ period }: { period: ReportPeriod }) {
  const query = useQuery({
    // Realtime invalida via `AdminRealtimeProvider` — fora do queryKey.
    queryKey: adminKeys.reports(`fin-${period}`),
    queryFn: () =>
      apiJson<FinancialReport>(
        `/api/v1/admin/reports?kind=financial&period=${period}`,
      ),
  });

  const d = query.data;
  if (query.isLoading || !d) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-primary" />
          <h2 className="font-serif text-base font-bold">Resultado</h2>
        </div>
        <Line
          label={`Bruto faturado (${d.gross.orderCount} pedidos)`}
          value={formatCatalogPrice(d.gross.totalCents)}
        />
        <Line
          label={`Taxas Mercado Pago${
            d.fees.estimatedCents > 0
              ? ` (${formatCatalogPrice(d.fees.estimatedCents)} estimado)`
              : ''
          }`}
          value={`−${formatCatalogPrice(d.fees.totalCents)}`}
          tone="negative"
        />
        <div className="border-t border-border pt-2">
          <Line
            label="Líquido"
            value={formatCatalogPrice(d.netCents)}
            tone="strong"
          />
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-card p-4">
        <h2 className="font-serif text-base font-bold">
          Por forma de pagamento
        </h2>
        {(['pix', 'cash', 'card'] as const).map((m) => (
          <Line
            key={m}
            label={`${METHOD_LABEL[m]} (${d.byMethod[m].count})`}
            value={
              d.byMethod[m].feeCents > 0
                ? `${formatCatalogPrice(d.byMethod[m].grossCents)} · taxa ${formatCatalogPrice(d.byMethod[m].feeCents)}`
                : formatCatalogPrice(d.byMethod[m].grossCents)
            }
          />
        ))}
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <RotateCcw className="size-4 text-muted-foreground" />
          <h2 className="font-serif text-base font-bold">Estornos</h2>
        </div>
        {d.refunds.count === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum estorno no período.
          </p>
        ) : (
          <>
            <Line
              label={`${d.refunds.count} pedido${d.refunds.count === 1 ? '' : 's'} · valor devolvido`}
              value={formatCatalogPrice(d.refunds.valueCents)}
            />
            <Line
              label="Taxa não recuperada (custo)"
              value={`−${formatCatalogPrice(d.refunds.feeCostCents)}`}
              tone="negative"
            />
          </>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-card p-4">
        <h2 className="font-serif text-base font-bold">Transações Pix</h2>
        {d.pixTransactions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum Pix pago no período.
          </p>
        ) : (
          <ul className="max-h-[420px] overflow-y-auto">
            {d.pixTransactions.map((t) => (
              <li
                key={t.orderNumber}
                className="flex items-baseline justify-between gap-3 border-t border-border py-2 text-xs first:border-t-0 first:pt-0"
              >
                <span className="text-muted-foreground tabular-nums">
                  #{t.orderNumber}
                  {t.estimated ? ' · taxa estimada' : ''}
                </span>
                <span className="tabular-nums">
                  {formatCatalogPrice(t.grossCents)} · taxa{' '}
                  {formatCatalogPrice(t.feeCents)} ·{' '}
                  <span className="font-semibold">
                    {formatCatalogPrice(t.netCents)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
