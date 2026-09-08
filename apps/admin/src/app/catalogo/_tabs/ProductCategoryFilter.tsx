'use client';

import { cn } from '@/lib/cn';
import type { AdminCategory, AdminProduct } from '@/modules/admin/types';

type Props = {
  categories: AdminCategory[];
  products: AdminProduct[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
};

/** Pills de filtro por categoria (mais "Todos"), com a contagem de cada uma. */
export function ProductCategoryFilter({
  categories,
  products,
  value,
  onChange,
}: Props) {
  const countFor = (categoryId: string | null) =>
    categoryId === null
      ? products.length
      : products.filter((product) => product.categoryId === categoryId).length;

  return (
    <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
      {[{ id: null, name: 'Todos' }, ...categories].map((item) => (
        <button
          key={item.id ?? 'all'}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            'shrink-0 rounded-full border px-3 py-1.5 text-2xs font-semibold transition-colors',
            value === item.id
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card hover:bg-accent',
          )}
        >
          {item.name} ({countFor(item.id)})
        </button>
      ))}
    </div>
  );
}
