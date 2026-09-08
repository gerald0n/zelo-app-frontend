'use client';

import { ProductGridCard } from '@/app/catalogo/_tabs/ProductGridCard';
import { ProductListRow } from '@/app/catalogo/_tabs/ProductListRow';
import type { ProductView } from '@/app/catalogo/_tabs/ProductToolbar';
import type { AdminProduct } from '@/modules/admin/types';

type Props = {
  products: AdminProduct[];
  view: ProductView;
  selectedIds: Set<string>;
  /** Mostra as setas ↑/↓ na lista (só quando a ordenação "Manual" está ativa). */
  reorderable: boolean;
  onToggleSelect: (product: AdminProduct) => void;
  onEdit: (product: AdminProduct) => void;
  onArchive: (product: AdminProduct) => void;
  onDuplicate: (product: AdminProduct) => void;
  onToggleAvailability: (product: AdminProduct) => void;
  onUpload: (product: AdminProduct, file: File) => void;
  onMove: (product: AdminProduct, direction: -1 | 1) => void;
};

export function ProductCollection({
  products,
  view,
  selectedIds,
  reorderable,
  onToggleSelect,
  onEdit,
  onArchive,
  onDuplicate,
  onToggleAvailability,
  onUpload,
  onMove,
}: Props) {
  if (products.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nenhum produto encontrado.
      </p>
    );
  }

  if (view === 'grid') {
    return (
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductGridCard
            key={product.id}
            product={product}
            selected={selectedIds.has(product.id)}
            onToggleSelect={onToggleSelect}
            onEdit={onEdit}
            onArchive={onArchive}
            onDuplicate={onDuplicate}
            onToggleAvailability={onToggleAvailability}
            onUpload={onUpload}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {products.map((product, index) => (
        <ProductListRow
          key={product.id}
          product={product}
          onEdit={onEdit}
          onArchive={onArchive}
          onDuplicate={onDuplicate}
          onToggleAvailability={onToggleAvailability}
          onUpload={onUpload}
          reorder={
            reorderable
              ? {
                  onMoveUp: () => onMove(product, -1),
                  onMoveDown: () => onMove(product, 1),
                  canMoveUp: index > 0,
                  canMoveDown: index < products.length - 1,
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}
