'use client';

import { useMemo, useState } from 'react';
import { Minus, Plus, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type { AdminAddon, AdminProduct } from '@/modules/admin/types';

export type ManualOrderItemDraft = {
  productId: string;
  quantity: number;
  customerNote: string;
  addOnIds: string[];
};

type Props = {
  products: AdminProduct[];
  addons: AdminAddon[];
  items: ManualOrderItemDraft[];
  onChange: (items: ManualOrderItemDraft[]) => void;
};

/** Ignora acento/caixa pra busca ("cafe" acha "Café"). */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const MAX_RESULTS = 12;

export default function AdminManualOrderItemPicker({
  products,
  addons,
  items,
  onChange,
}: Props) {
  const [query, setQuery] = useState('');
  const productById = new Map(products.map((product) => [product.id, product]));
  const addonById = new Map(addons.map((addon) => [addon.id, addon]));

  const results = useMemo(() => {
    const active = products.filter((p) => p.isActive);
    const q = normalize(query.trim());
    const matches = q
      ? active.filter((p) => normalize(p.name).includes(q))
      : [...active].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return matches.slice(0, MAX_RESULTS);
  }, [products, query]);

  const addItem = (productId: string) => {
    onChange([
      ...items,
      { productId, quantity: 1, customerNote: '', addOnIds: [] },
    ]);
  };

  const updateItem = (index: number, patch: Partial<ManualOrderItemDraft>) => {
    onChange(
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const toggleAddon = (index: number, addOnId: string) => {
    const item = items[index];
    const has = item.addOnIds.includes(addOnId);
    updateItem(index, {
      addOnIds: has
        ? item.addOnIds.filter((id) => id !== addOnId)
        : [...item.addOnIds, addOnId],
    });
  };

  const total = items.reduce((sum, item) => {
    const product = productById.get(item.productId);
    if (!product) return sum;
    const addonsSum = item.addOnIds.reduce(
      (s, id) => s + (addonById.get(id)?.priceCents ?? 0),
      0,
    );
    return sum + (product.priceCents + addonsSum) * item.quantity;
  }, 0);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto pelo nome…"
            className="h-10 w-full rounded-md border border-border pl-9 pr-3 text-sm"
          />
        </div>

        <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Nenhum produto encontrado.
            </p>
          ) : (
            results.map((product) => {
              const outOfStock = product.stockQuantity === 0;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addItem(product.id)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {product.name}
                    </p>
                    <p className="truncate text-2xs text-muted-foreground">
                      {product.categoryName}
                      {outOfStock ? ' · Esgotado' : ''}
                      {!product.isAvailable && !outOfStock
                        ? ' · Indisponível'
                        : ''}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold">
                    {formatCatalogPrice(product.priceCents)}
                    <Plus className="size-3.5 text-primary" />
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum item adicionado.</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item, index) => {
            const product = productById.get(item.productId);
            if (!product) return null;
            const allowedAddons = addons.filter((addon) =>
              product.addonIds.includes(addon.id),
            );
            return (
              <div
                key={`${item.productId}-${index}`}
                className="space-y-2 rounded-lg border border-border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{product.name}</p>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-muted-foreground"
                    aria-label="Remover item"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateItem(index, {
                        quantity: Math.max(1, item.quantity - 1),
                      })
                    }
                    className="flex size-7 items-center justify-center rounded-md border border-border"
                    aria-label="Diminuir quantidade"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateItem(index, { quantity: item.quantity + 1 })
                    }
                    className="flex size-7 items-center justify-center rounded-md border border-border"
                    aria-label="Aumentar quantidade"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                {allowedAddons.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {allowedAddons.map((addon) => {
                      const selected = item.addOnIds.includes(addon.id);
                      return (
                        <button
                          key={addon.id}
                          type="button"
                          onClick={() => toggleAddon(index, addon.id)}
                          className={cn(
                            'rounded-md border px-2.5 py-1 text-2xs font-semibold',
                            selected
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border',
                          )}
                        >
                          + {addon.name}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <Input
                  value={item.customerNote}
                  onChange={(e) =>
                    updateItem(index, { customerNote: e.target.value })
                  }
                  placeholder="Observação do item (opcional)"
                  className="h-9 w-full rounded-md border border-border px-3 text-xs"
                />
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 ? (
        <p className="text-right text-sm font-bold">
          Subtotal: {formatCatalogPrice(total)}
        </p>
      ) : null}
    </div>
  );
}
