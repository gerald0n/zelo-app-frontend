'use client';

import { cn } from '@/lib/cn';

type Props = {
  current: number;
  total: number;
  labels: string[];
  className?: string;
};

export default function CheckoutProgress({
  current,
  total,
  labels,
  className,
}: Props) {
  const pct = total > 1 ? ((current - 1) / (total - 1)) * 100 : 0;

  return (
    <div className={cn('min-w-0 px-3 py-3 sm:px-4', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-2xs tabular-nums text-muted-foreground">
          {String(current).padStart(2, '0')}
          <span className="mx-1 text-border">/</span>
          {String(total).padStart(2, '0')}
        </span>
        <span className="truncate text-sm font-semibold text-foreground">
          {labels[current - 1] ?? ''}
        </span>
      </div>
      <div className="mt-2 h-px w-full bg-border">
        <div
          className="h-px bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
