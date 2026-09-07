import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'field-sizing-content flex min-h-16 w-full rounded-md border border-input bg-card px-3 py-2 text-base outline-none transition-[border-color,box-shadow] duration-150',
        'placeholder:text-muted-foreground',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
        'aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'md:text-sm',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
