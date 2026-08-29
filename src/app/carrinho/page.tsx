'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import {
  formatCatalogPrice,
  type CatalogProduct,
} from '@/modules/catalog/types';
import {
  revalidateCartAgainstCatalog,
  useCart,
  useCartStore,
  type CartItem,
} from '@/modules/carts';
import { useAuth } from '@/contexts/AuthContext';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { checkoutContinuePath } from '@/modules/auth/checkout-path';
import { ProductThumb } from '@/components/product-thumb';
import { Separator } from '@/components/ui/separator';
import {
  mobilePageColumnClass,
  pageHeaderBarClass,
  pagePrimaryButtonClass,
} from '@/lib/layout';
import { cn } from '@/lib/cn';

function useCartHydrated() {
  return useSyncExternalStore(
    (onStoreChange) => useCartStore.persist.onFinishHydration(onStoreChange),
    () => useCartStore.persist.hasHydrated(),
    () => false,
  );
}

function CartItemRow({ item }: { item: CartItem }) {
  const { removeItem, updateQuantity } = useCart();
  const { notify } = useShopExperience();
  const { confirm } = useAppDialog();

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-2.5">
      <ProductThumb
        src={item.image}
        alt={item.name}
        className="size-14 shrink-0 rounded-lg"
        iconClassName="size-7"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="line-clamp-2 text-sm font-semibold">{item.name}</p>
        {item.selectedAddons.length > 0 ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {item.selectedAddons.map((a) => a.name).join(', ')}
          </p>
        ) : null}
        {item.note ? (
          <p className="line-clamp-2 text-xs italic text-muted-foreground">
            Obs.: {item.note}
          </p>
        ) : null}
        <div className="mt-1.5 flex items-center justify-between">
          <div className="flex items-center overflow-hidden rounded-md border border-border">
            <button
              type="button"
              aria-label="Diminuir"
              className="p-1.5"
              onClick={() => {
                updateQuantity(item.id, item.quantity - 1);
                notify(`${item.name} removido do carrinho.`);
              }}
            >
              <Minus className="size-4" />
            </button>
            <span className="px-2.5 text-sm font-semibold">
              {item.quantity}
            </span>
            <button
              type="button"
              aria-label="Aumentar"
              className="p-1.5"
              onClick={() => {
                updateQuantity(item.id, item.quantity + 1);
                notify('Quantidade atualizada.');
              }}
            >
              <Plus className="size-4" />
            </button>
          </div>
          <span className="text-sm font-bold">
            {formatCatalogPrice(item.price * item.quantity)}
          </span>
        </div>
      </div>
      <button
        type="button"
        aria-label="Remover item"
        className="p-1 text-muted-foreground"
        onClick={async () => {
          const ok = await confirm({
            title: 'Excluir do carrinho',
            description:
              item.quantity === 1
                ? `Excluir ${item.name} do carrinho?`
                : `Excluir as ${item.quantity} unidades de ${item.name} do carrinho?`,
            confirmLabel: 'Excluir',
            tone: 'destructive',
          });
          if (!ok) return;
          removeItem(item.id);
          notify(
            item.quantity > 1
              ? `${item.quantity}× ${item.name} removido do carrinho.`
              : `${item.name} removido do carrinho.`,
          );
        }}
      >
        <Trash2 className="size-[18px]" />
      </button>
    </div>
  );
}

export default function CarrinhoPage() {
  const router = useRouter();
  const hydrated = useCartHydrated();
  const {
    items,
    subtotal,
    productsSubtotal,
    addonsTotal,
    totalItems,
    clearCart,
    replaceItems,
  } = useCart();
  const { user, identityReady } = useAuth();
  const { notify } = useShopExperience();
  const { confirm } = useAppDialog();
  const revalidated = useRef(false);

  useEffect(() => {
    if (!hydrated || revalidated.current) return;
    revalidated.current = true;

    let cancelled = false;
    const snapshot = useCartStore.getState().items;

    (async () => {
      try {
        const response = await fetch('/api/v1/catalog/products', {
          method: 'GET',
          cache: 'no-store',
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          products?: CatalogProduct[];
        };
        if (cancelled || !payload.products) return;

        const result = revalidateCartAgainstCatalog(snapshot, payload.products);
        if (result.changes.length === 0) return;

        replaceItems(result.items);
        const removed = result.changes.filter(
          (change) =>
            change.reason === 'product_unavailable' ||
            change.reason === 'product_removed',
        ).length;
        const updated = result.changes.length - removed;
        if (removed > 0) {
          notify(
            `${removed} item(ns) removido(s) por indisponibilidade.`,
            'error',
          );
        } else if (updated > 0) {
          notify('Carrinho atualizado com preços atuais do cardápio.');
        }
      } catch {
        // Revalidação é best-effort; o checkout fará validação final.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, notify, replaceItems]);

  const handleClear = async () => {
    const ok = await confirm({
      title: 'Esvaziar carrinho',
      description: 'Remover todos os itens do carrinho?',
      confirmLabel: 'Remover tudo',
      tone: 'destructive',
    });
    if (!ok) return;
    clearCart();
    notify('Carrinho esvaziado.');
  };

  const handleCheckout = () => {
    if (!identityReady) return;
    router.push(checkoutContinuePath(user));
  };

  const renderCheckoutAction = () => (
    <>
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold">Total</span>
        <span className="text-xl font-bold">
          {formatCatalogPrice(subtotal)}
        </span>
      </div>
      <button
        type="button"
        onClick={handleCheckout}
        disabled={!identityReady}
        className={pagePrimaryButtonClass}
      >
        {identityReady ? 'Finalizar pedido' : 'Preparando…'}
      </button>
    </>
  );

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando carrinho…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className={cn(
          'flex min-h-dvh flex-col bg-background',
          mobilePageColumnClass,
        )}
      >
        <header className={pageHeaderBarClass}>
          <Link href="/" aria-label="Voltar ao cardápio">
            <ArrowLeft className="size-6" />
          </Link>
          <h1 className="text-[17px] font-semibold">Carrinho</h1>
          <span className="w-6" />
        </header>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 px-10 text-center">
          <ShoppingBag className="size-14 text-muted-foreground" />
          <p className="mt-2 text-xl font-semibold">Seu carrinho está vazio</p>
          <p className="text-sm leading-5 text-muted-foreground">
            Adicione itens do cardápio para continuar.
          </p>
          <Link
            href="/"
            className="mt-3 rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-white"
          >
            Ver cardápio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'mx-auto flex min-h-dvh w-full flex-col bg-background lg:max-w-5xl',
        mobilePageColumnClass,
      )}
    >
      <header className={cn(pageHeaderBarClass, 'lg:px-0')}>
        <Link href="/" aria-label="Voltar ao cardápio">
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="text-[17px] font-semibold">Carrinho · {totalItems}</h1>
        <button
          type="button"
          onClick={() => void handleClear()}
          className="text-sm font-medium text-destructive"
        >
          Limpar
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-3 lg:grid lg:grid-cols-3 lg:items-start lg:gap-5 lg:px-0 lg:py-5">
        <div className="space-y-2.5 lg:col-span-2">
          {items.map((item) => (
            <CartItemRow key={item.id} item={item} />
          ))}
        </div>

        <div className="mt-2 space-y-2 rounded-xl border border-border bg-card p-3 lg:sticky lg:top-6 lg:col-span-1 lg:mt-0">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Produtos</span>
            <span className="text-sm font-medium">
              {formatCatalogPrice(productsSubtotal)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Adicionais</span>
            <span className="text-sm font-medium">
              {formatCatalogPrice(addonsTotal)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="text-sm font-medium">
              {formatCatalogPrice(subtotal)}
            </span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Entrega</span>
            <span className="text-sm font-medium text-muted-foreground">
              A calcular
            </span>
          </div>
          <div className="hidden space-y-3 border-t border-border pt-3 lg:block">
            {renderCheckoutAction()}
          </div>
        </div>
      </div>

      <div className="space-y-2.5 border-t border-border bg-background px-3 pb-4 pt-2.5 lg:hidden">
        {renderCheckoutAction()}
      </div>
    </div>
  );
}
