'use client';

import Link from 'next/link';
import { ArrowRight, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { formatCatalogPrice } from '@/modules/catalog/types';

export default function DesktopCartPanel() {
  const { items, subtotal, totalItems, updateQuantity } = useCart();

  return (
    <aside className="sticky top-0 flex h-dvh w-[320px] shrink-0 flex-col border-l border-border bg-card pt-4">
      <div className="flex items-center justify-between px-4">
        <div>
          <p className="text-2xs font-semibold tracking-[1.2px] text-muted-foreground">
            SEU PEDIDO
          </p>
          <h2 className="mt-0.5 text-lg font-bold">Carrinho</h2>
        </div>
        <span className="flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-primary px-[7px] text-xs font-bold text-white">
          {totalItems}
        </span>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-4">
        {items.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-[7px]">
            <ShoppingBag className="size-[30px] text-muted-foreground" />
            <p className="text-sm font-semibold">Seu carrinho está vazio</p>
            <p className="text-xs text-muted-foreground">
              Adicione uma delícia do cardápio.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="space-y-2 border-b border-border py-3"
            >
              <div className="flex justify-between gap-3">
                <p className="line-clamp-2 flex-1 text-sm font-semibold">
                  {item.name}
                </p>
                <p className="text-sm font-bold">
                  {formatCatalogPrice(item.price * item.quantity)}
                </p>
              </div>
              <div className="inline-flex items-center rounded-md border border-border">
                <button
                  type="button"
                  className="flex size-7 items-center justify-center"
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="min-w-[18px] text-center text-xs">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  className="flex size-7 items-center justify-center"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-3 border-t border-border p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Subtotal</span>
          <span className="text-lg font-bold">
            {formatCatalogPrice(subtotal)}
          </span>
        </div>
        <Link
          href="/carrinho"
          aria-disabled={!items.length}
          className={`flex h-11 items-center justify-center gap-2 rounded-md text-sm font-semibold ${
            items.length
              ? 'bg-primary text-white'
              : 'pointer-events-none bg-muted text-muted-foreground'
          }`}
        >
          Continuar pedido
          <ArrowRight className="size-[18px]" />
        </Link>
      </div>
    </aside>
  );
}
