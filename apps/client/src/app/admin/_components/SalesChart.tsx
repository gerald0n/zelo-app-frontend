'use client';

import { useState } from 'react';
import { formatCatalogPrice } from '@/modules/catalog/types';
import { cn } from '@/lib/cn';
import type { SalesBucket } from '@/app/admin/_components/dashboard-metrics';

type Props = { buckets: SalesBucket[]; dense?: boolean };

/**
 * Curva de vendas por período — série única (faturamento), barras em CSS.
 * Cada barra revela o valor no hover; eixo recessivo, sem grade.
 */
export function SalesChart({ buckets, dense = false }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...buckets.map((b) => b.cents));
  const peakIndex = buckets.reduce(
    (best, b, i) => (b.cents > buckets[best].cents ? i : best),
    0,
  );
  const total = buckets.reduce((s, b) => s + b.cents, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-base font-bold">Curva de vendas</h2>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            {total > 0
              ? `Pico em ${buckets[peakIndex].label} · ${formatCatalogPrice(buckets[peakIndex].cents)}`
              : 'Sem vendas no período'}
          </p>
        </div>
        <span className="shrink-0 text-2xs font-semibold text-muted-foreground">
          Total {formatCatalogPrice(total)}
        </span>
      </div>

      <div className="relative mt-4 flex h-40 items-end gap-[2px]">
        {buckets.map((bucket, index) => {
          const heightPct = max > 0 ? (bucket.cents / max) * 100 : 0;
          const isHovered = hovered === index;
          return (
            <button
              key={bucket.label}
              type="button"
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              className="group relative flex h-full flex-1 flex-col justify-end"
              aria-label={`${bucket.label}: ${formatCatalogPrice(bucket.cents)}, ${bucket.count} pedidos`}
            >
              {isHovered ? (
                <span className="pointer-events-none absolute inset-x-0 bottom-full z-10 mb-1 flex flex-col items-center">
                  <span className="whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-2xs font-semibold text-background">
                    {formatCatalogPrice(bucket.cents)}
                  </span>
                </span>
              ) : null}
              <span
                className={cn(
                  'w-full rounded-t-[4px] transition-colors',
                  bucket.cents === 0
                    ? 'bg-muted'
                    : index === peakIndex
                      ? 'bg-primary'
                      : 'bg-primary/55',
                  isHovered && 'bg-primary',
                )}
                style={{
                  height: `${Math.max(heightPct, bucket.cents > 0 ? 4 : 2)}%`,
                }}
              />
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          'mt-1.5 flex gap-[2px] text-center text-2xs tabular-nums text-muted-foreground',
          dense && 'text-[9px]',
        )}
      >
        {buckets.map((bucket, index) => (
          <span key={bucket.label} className="flex-1 truncate">
            {dense && index % 3 !== 0 ? '' : bucket.label}
          </span>
        ))}
      </div>
    </div>
  );
}
