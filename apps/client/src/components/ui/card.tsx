import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Superfície de conteúdo. Elevação só quando comunica hierarquia:
 * - `plain`   — sem moldura, só o fundo do card (agrupa sem pesar).
 * - `outline` — 1px hairline (padrão).
 * - `raised`  — hairline + sombra quase invisível (destaque pontual).
 */
const cardVariants = cva('rounded-lg bg-card text-card-foreground', {
  variants: {
    variant: {
      plain: '',
      outline: 'border border-border',
      raised: 'border border-border shadow-sm',
    },
  },
  defaultVariants: {
    variant: 'outline',
  },
});

function Card({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Card, cardVariants };
