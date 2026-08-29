import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Placeholder de carregamento. Deve ter o formato do conteúdo que substitui —
 * evitar spinner genérico. A pulsação respeita `prefers-reduced-motion`.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        'rounded-md bg-muted/70 motion-safe:animate-pulse',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
