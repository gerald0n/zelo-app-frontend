'use client';

import { useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
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

export default function AdminManualOrderItemPicker({
  products,
  addons,
  items,
  onChange,
}: Props) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const productById = new Map(products.map((product) => [product.id, product]));
  const addonById = new Map(addons.map((addon) => [addon.id, addon]));

  const addItem = () => {
    if (!selectedProductId) return;
    onChange([
      ...items,
      {
        productId: selectedProductId,
        quantity: 1,
        customerNote: '',
        addOnIds: [],
      },
    ]);
    setSelectedProductId('');
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
      <div className="flex gap-2">
        <select
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          className="h-10 flex-1 rounded-md border border-border px-3 text-sm"
        >
          <option value="">Selecione um produto</option>
          {products
            .filter((product) => product.isActive)
            .map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · {formatCatalogPrice(product.priceCents)}
                {product.stockQuantity === 0 ? ' (esgotado)' : ''}
              </option>
            ))}
        </select>
        <button
          type="button"
          onClick={addItem}
          disabled={!selectedProductId}
          className="flex shrink-0 items-center justify-center rounded-md bg-primary px-3 py-2 text-white disabled:opacity-50"
          aria-label="Adicionar item"
        >
          <Plus className="size-4" />
        </button>
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
