'use client';

import { formatCatalogPrice } from '@/modules/catalog/types';

export type PizzaSummaryLine = {
  key: string;
  label: string;
  priceCents?: number;
  muted?: boolean;
};

type Props = {
  lines: PizzaSummaryLine[];
};

/** Resumo parcial da pizza — atualiza em tempo real conforme os sabores/adicionais são escolhidos. */
export function PizzaSummary({ lines }: Props) {
  return (
    <section className="space-y-1.5 rounded-xl border border-border bg-card p-3">
      {lines.map((line) => (
        <div
          key={line.key}
          className="flex items-baseline justify-between gap-3"
        >
          <span
            className={
              line.muted
                ? 'text-sm text-muted-foreground'
                : 'text-sm font-medium'
            }
          >
            {line.label}
          </span>
          {line.priceCents !== undefined ? (
            <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
              {formatCatalogPrice(line.priceCents)}
            </span>
          ) : null}
        </div>
      ))}
    </section>
  );
}
