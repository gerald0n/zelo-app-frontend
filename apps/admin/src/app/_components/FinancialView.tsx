'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RotateCcw, Wallet } from 'lucide-react';
import { ApiError, apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type { ReportPeriod } from '@/modules/admin/reports';
import type { FinancialReport } from '@/modules/admin/financial-report';

type PixRefundSweepResult = {
  scanned: number;
  refunded: number;
  alreadyRefunded: number;
  failed: number;
};

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
  const queryClient = useQueryClient();
  const { alert } = useAppDialog();
  const [sweeping, setSweeping] = useState(false);

  const query = useQuery({
    // Realtime invalida via `AdminRealtimeProvider` — fora do queryKey.
    queryKey: adminKeys.reports(`fin-${period}`),
    queryFn: () =>
      apiJson<FinancialReport>(
        `/api/v1/admin/reports?kind=financial&period=${period}`,
      ),
  });

  const pendingRefunds = useQuery({
    queryKey: adminKeys.pixRefundsPending(),
    queryFn: () => apiJson<{ pending: number }>('/api/v1/admin/pix-refunds'),
  });

  const runRefundSweep = async () => {
    if (sweeping) return;
    setSweeping(true);
    try {
      const r = await apiJson<PixRefundSweepResult>(
        '/api/v1/admin/pix-refunds',
        { method: 'POST' },
      );
      const done = r.refunded + r.alreadyRefunded;
      await alert({
        title: 'Estornos processados',
        description:
          `${done} de ${r.scanned} resolvido${done === 1 ? '' : 's'}` +
          (r.failed > 0
            ? `. ${r.failed} ainda com erro — tente de novo em alguns minutos ou estorne pelo painel do Mercado Pago.`
            : '.'),
      });
    } catch (cause) {
      await alert({
        title: 'Não foi possível processar os estornos',
        description:
          cause instanceof ApiError
            ? cause.message
            : 'A operação pode ter sido interrompida. Confira a contagem e rode de novo se ainda houver pendências.',
      });
    } finally {
      setSweeping(false);
      // Sempre revalida: mesmo um run interrompido no meio já estornou parte.
      void queryClient.invalidateQueries({
        queryKey: adminKeys.pixRefundsPending(),
      });
      void queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'reports'],
      });
      void queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'orders'],
      });
    }
  };

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

        {pendingRefunds.data && pendingRefunds.data.pending > 0 ? (
          <div className="space-y-2 border-t border-border pt-2">
            <p className="text-xs leading-4 text-destructive">
              {pendingRefunds.data.pending} pedido
              {pendingRefunds.data.pending === 1 ? '' : 's'} Pix cancelado
              {pendingRefunds.data.pending === 1 ? '' : 's'} sem estorno. O
              sistema reprocessa sozinho a cada 10 min — use o botão para forçar
              agora.
            </p>
            <button
              type="button"
              disabled={sweeping}
              onClick={() => void runRefundSweep()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/40 py-2.5 text-sm font-semibold text-destructive disabled:opacity-60"
            >
              {sweeping ? <Loader2 className="size-4 animate-spin" /> : null}
              Processar estornos pendentes
            </button>
          </div>
        ) : null}
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
