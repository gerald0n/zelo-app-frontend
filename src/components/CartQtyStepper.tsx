'use client';

import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import { cn } from '@/lib/utils';

type StepperProps = {
  quantity: number;
  productName: string;
  onDecrease: () => void;
  onIncrease: () => void;
  compact?: boolean;
  className?: string;
};

export function CartQtyStepper({
  quantity,
  productName,
  onDecrease,
  onIncrease,
  compact = false,
  className,
}: StepperProps) {
  const hit = compact ? 'size-7' : 'size-8';

  return (
    <div
      className={cn(
        'flex items-center overflow-hidden rounded-md border border-border bg-card',
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Remover 1 ${productName} do carrinho`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onDecrease();
        }}
        className={cn(
          'flex items-center justify-center text-foreground transition-transform duration-100 active:scale-90',
          hit,
        )}
      >
        <Minus className={compact ? 'size-3' : 'size-3.5'} />
      </button>
      <span className="min-w-4 px-0.5 text-center text-xs font-semibold tabular-nums">
        {quantity}
      </span>
      <button
        type="button"
        aria-label={`Adicionar mais 1 ${productName} ao carrinho`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onIncrease();
        }}
        className={cn(
          'flex items-center justify-center text-foreground transition-transform duration-100 active:scale-90',
          hit,
        )}
      >
        <Plus className={compact ? 'size-3' : 'size-3.5'} />
      </button>
    </div>
  );
}

type ControlsProps = {
  productId: string;
  productName: string;
  quantity: number;
  compact?: boolean;
  onIncrease: () => void;
  className?: string;
};

export function CatalogCartControls({
  productId,
  productName,
  quantity,
  compact = false,
  onIncrease,
  className,
}: ControlsProps) {
  const { decrementProduct, removeProduct } = useCart();
  const { notify } = useShopExperience();
  const { confirm } = useAppDialog();
  const hit = compact ? 'size-7' : 'size-8';

  const handleDecrease = () => {
    decrementProduct(productId);
    notify(`${productName} removido do carrinho.`);
  };

  const handleRemoveAll = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const ok = await confirm({
      title: 'Excluir do carrinho',
      description:
        quantity === 1
          ? `Excluir ${productName} do carrinho?`
          : `Excluir as ${quantity} unidades de ${productName} do carrinho?`,
      confirmLabel: 'Excluir',
      tone: 'destructive',
    });
    if (!ok) return;
    removeProduct(productId);
    notify(
      quantity > 1
        ? `${quantity}× ${productName} removido do carrinho.`
        : `${productName} removido do carrinho.`,
    );
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <CartQtyStepper
        compact={compact}
        quantity={quantity}
        productName={productName}
        onDecrease={handleDecrease}
        onIncrease={onIncrease}
        className="min-w-0 flex-1 justify-between"
      />
      <button
        type="button"
        aria-label={`Excluir ${productName} do carrinho`}
        onClick={(event) => void handleRemoveAll(event)}
        className={cn(
          'flex items-center justify-center rounded-md border border-border text-destructive transition-transform duration-100 active:scale-90',
          hit,
        )}
      >
        <Trash2 className={compact ? 'size-3' : 'size-3.5'} />
      </button>
    </div>
  );
}

type ItemActionsProps = {
  productId: string;
  productName: string;
  quantity: number;
  available: boolean;
  compact?: boolean;
  onAdd: () => void;
};

export function CatalogItemActions({
  productId,
  productName,
  quantity,
  available,
  compact = false,
  onAdd,
}: ItemActionsProps) {
  if (quantity > 0) {
    return (
      <CatalogCartControls
        compact={compact}
        productId={productId}
        productName={productName}
        quantity={quantity}
        onIncrease={onAdd}
      />
    );
  }

  if (!available) return null;

  const hit = compact ? 'size-7' : 'size-8';

  return (
    <button
      type="button"
      aria-label={`Adicionar ${productName} à sacola`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onAdd();
      }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-transform duration-100 hover:bg-primary/90 active:scale-90',
        hit,
      )}
    >
      <ShoppingCart className={compact ? 'size-3' : 'size-3.5'} />
    </button>
  );
}
