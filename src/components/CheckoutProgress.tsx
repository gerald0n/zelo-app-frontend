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
  return (
    <div
      className={cn('flex min-w-0 items-start px-3 py-2.5 sm:px-4', className)}
    >
      {Array.from({ length: total }).map((_, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div
            key={step}
            className="flex min-w-0 flex-1 items-start last:flex-none"
          >
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex size-7 items-center justify-center rounded-full border-[1.5px] text-xs font-bold',
                  done || active
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-muted text-muted-foreground',
                )}
              >
                {step}
              </div>
              <span
                className={cn(
                  'max-w-[4.5rem] truncate text-center text-[11px]',
                  done || active ? 'text-foreground' : 'text-muted-foreground',
                  active && 'font-semibold',
                )}
              >
                {labels[i]}
              </span>
            </div>
            {i < total - 1 ? (
              <div
                className={cn(
                  'mx-1 mt-[13px] h-[1.5px] flex-1',
                  done ? 'bg-primary' : 'bg-border',
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
