import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

const STEPS = [
  { n: 1, label: 'Identificação' },
  { n: 2, label: 'Itens da comanda' },
  { n: 3, label: 'Pagamento' },
] as const;

/** Trilho de progresso da nova comanda (3 passos). */
export function NewOrderStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((step, index) => {
        const done = current > step.n;
        const active = current === step.n;
        return (
          <li key={step.n} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border text-2xs font-bold',
                done || active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground',
              )}
            >
              {done ? <Check className="size-3.5" /> : step.n}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  'block text-[10px] font-bold uppercase tracking-wide',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                Passo {step.n}
                {active ? ' (atual)' : ''}
              </span>
              <span
                className={cn(
                  'block truncate text-xs font-semibold',
                  active || done ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </span>
            {index < STEPS.length - 1 ? (
              <span
                className={cn(
                  'ml-auto hidden h-px flex-1 sm:block',
                  done ? 'bg-primary' : 'bg-border',
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
