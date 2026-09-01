'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCartStore } from '@/modules/carts/cart-store';
import {
  clearReconciledMarker,
  getReconciledUserId,
  markReconciled,
} from '@/modules/carts/reconcile-marker';
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
  const [hydrated, setHydrated] = useState(
    () => useCartStore.persist?.hasHydrated() ?? false,
  );
  const reconciledForUser = useRef<string | null>(null);
  const skipPush = useRef(false);

  useEffect(() => {
    // Durante o prerender não há `localStorage`; o middleware persist fica
    // inativo e `useCartStore.persist` é undefined até o cliente montar.
    const persist = useCartStore.persist;
    if (!persist) return;
    const markHydrated = () => setHydrated(true);
    const unsub = persist.onFinishHydration(markHydrated);
    // A reidratação do localStorage é síncrona: se já ocorreu antes deste
    // efeito, `onFinishHydration` não dispara — acertamos fora do corpo.
    if (persist.hasHydrated()) queueMicrotask(markHydrated);
    return unsub;
  }, []);

  useEffect(() => {
    if (!identityReady || !hydrated) return;
    if (!userId) {
      reconciledForUser.current = null;
      return;
    }
    if (reconciledForUser.current === userId) return;

    // Este navegador já fundiu o carrinho anônimo nesta conta (outra aba,
    // recarga da página, reabertura do PWA). Repetir o reconcile somaria as
    // quantidades de novo — daqui pra frente o sync via PUT /cart basta.
    if (getReconciledUserId() === userId) {
      reconciledForUser.current = userId;
      return;
    }

    let cancelled = false;
    const localItems = useCartStore.getState().items;

    // Marca ANTES do round-trip: navegações rápidas (ou re-montagens) podem
    // cancelar este efeito antes da resposta chegar, mas o servidor já
    // processou o merge — sem a marca otimista, a próxima montagem
    // reconciliaria de novo e somaria as quantidades.
    reconciledForUser.current = userId;
    markReconciled(userId);

    void postReconcile(localItems).then((merged) => {
      if (!merged) {
        // Falha real (rede/500). Libera nova tentativa numa próxima montagem,
        // desde que o usuário ainda esteja nesta sessão.
        if (!cancelled) {
          reconciledForUser.current = null;
          clearReconciledMarker();
        }
        return;
      }
      if (cancelled) return;
      skipPush.current = true;
      replaceItems(merged);
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
