'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCartStore } from '@/modules/carts/cart-store';
import { cartItemsToSyncLines, type CartItem } from '@/modules/carts/types';

async function postReconcile(items: CartItem[]): Promise<CartItem[] | null> {
  try {
    const response = await fetch('/api/v1/cart/reconcile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cartItemsToSyncLines(items) }),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { items?: CartItem[] };
    return Array.isArray(json.items) ? json.items : null;
  } catch {
    return null;
  }
}

async function putCart(items: CartItem[], signal: AbortSignal): Promise<void> {
  await fetch('/api/v1/cart', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: cartItemsToSyncLines(items) }),
    signal,
  });
}

/**
 * Após o login, une o carrinho local (anônimo) ao do Cliente e passa a
 * persistir alterações no servidor para outros dispositivos.
 */
export function CartSync() {
  const { user, identityReady } = useAuth();
  const userId = user?.id ?? user?.phone;
  const items = useCartStore((state) => state.items);
  const updatedAt = useCartStore((state) => state.updatedAt);
  const replaceItems = useCartStore((state) => state.replaceItems);
  const [hydrated, setHydrated] = useState(() =>
    useCartStore.persist.hasHydrated(),
  );
  const reconciledForUser = useRef<string | null>(null);
  const skipPush = useRef(false);

  useEffect(() => {
    const unsub = useCartStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!identityReady || !hydrated) return;
    if (!userId) {
      reconciledForUser.current = null;
      return;
    }
    if (reconciledForUser.current === userId) return;

    let cancelled = false;
    const localItems = useCartStore.getState().items;

    void postReconcile(localItems).then((merged) => {
      if (cancelled || !merged) return;
      skipPush.current = true;
      replaceItems(merged);
      reconciledForUser.current = userId;
    });

    return () => {
      cancelled = true;
    };
  }, [identityReady, hydrated, userId, replaceItems]);

  useEffect(() => {
    if (!identityReady || !hydrated || !userId) return;
    if (reconciledForUser.current !== userId) return;
    if (skipPush.current) {
      skipPush.current = false;
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void putCart(items, controller.signal).catch(() => {
        /* persistência é best-effort */
      });
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [identityReady, hydrated, userId, items, updatedAt]);

  return null;
}
