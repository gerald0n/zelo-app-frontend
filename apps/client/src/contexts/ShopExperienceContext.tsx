'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { randomUUID } from '@/lib/random-id';
import {
  getFavoritesSnapshot,
  getServerFavoritesSnapshot,
  subscribeFavorites,
  writeFavorites,
} from '@/contexts/shop-experience/favorites-store';
import {
  canGroup,
  formatGroupedMessage,
  parseNotify,
  type ToastItem,
} from '@/contexts/shop-experience/toast-grouping';

const TOAST_MS = 2800;
const TOAST_DRAWER_MS = 460;
const MAX_TOASTS = 3;

type ShopExperienceValue = {
  favorites: Set<string>;
  toggleFavorite: (productId: string, productName: string) => void;
  notify: (message: string, type?: 'success' | 'error') => void;
};

const ShopExperienceContext = createContext<ShopExperienceValue | null>(null);

export function ShopExperienceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const favoriteIds = useSyncExternalStore(
    subscribeFavorites,
    getFavoritesSnapshot,
    getServerFavoritesSnapshot,
  );
  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [drawer, setDrawer] = useState<'closed' | 'open' | 'closing'>('closed');
  const [visibleToasts, setVisibleToasts] = useState<ToastItem[]>([]);
  const toastsRef = useRef<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    toastsRef.current = toasts;
  }, [toasts]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // Máquina do drawer derivada no render (padrão "adjusting state on change"
  // do React), não em effect: toast na fila → 'open'; fila esvaziou → 'closing'
  // até o timeout abaixo levar para 'closed'. `visibleToasts` segura o último
  // conteúdo não-vazio durante a animação de saída.
  const hasToasts = toasts.length > 0;
  const nextDrawer = hasToasts
    ? 'open'
    : drawer === 'closed'
      ? 'closed'
      : 'closing';
  if (nextDrawer !== drawer) setDrawer(nextDrawer);
  if (hasToasts && visibleToasts !== toasts) setVisibleToasts(toasts);

  useEffect(() => {
    if (drawer !== 'closing') return;
    const id = window.setTimeout(() => {
      setDrawer('closed');
      setVisibleToasts([]);
    }, TOAST_DRAWER_MS);
    return () => window.clearTimeout(id);
  }, [drawer]);

  const clearToastTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismissToast = useCallback(
    (id: string) => {
      clearToastTimer(id);
      const next = toastsRef.current.filter((toast) => toast.id !== id);
      toastsRef.current = next;
      setToasts(next);
    },
    [clearToastTimer],
  );

  const scheduleDismiss = useCallback(
    (id: string) => {
      clearToastTimer(id);
      timersRef.current.set(
        id,
        setTimeout(() => dismissToast(id), TOAST_MS),
      );
    },
    [clearToastTimer, dismissToast],
  );

  const dismissAll = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    toastsRef.current = [];
    setToasts([]);
  }, []);

  const notify = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      const parsed = parseNotify(message);
      const incoming: ToastItem = {
        id: randomUUID(),
        type,
        kind: parsed.kind,
        count: parsed.count,
        names: parsed.names,
        message: formatGroupedMessage(
          parsed.kind,
          parsed.count,
          parsed.names,
          message,
        ),
      };
      const prev = toastsRef.current;
      const last = prev[prev.length - 1];

      if (last && last.type === type && last.kind === 'generic' && last.message === incoming.message) {
        scheduleDismiss(last.id);
        return;
      }

      if (last && canGroup(last, incoming)) {
        const count = last.count + incoming.count;
        const names = [...last.names, ...incoming.names];
        const next = prev.map((toast) =>
          toast.id === last.id
            ? {
                ...toast,
                count,
                names,
                message: formatGroupedMessage(toast.kind, count, names, message),
              }
            : toast,
        );
        toastsRef.current = next;
        setToasts(next);
        scheduleDismiss(last.id);
        return;
      }

      const next = [...prev, incoming].slice(-MAX_TOASTS);
      const dropped = prev.filter(
        (toast) => !next.some((item) => item.id === toast.id),
      );
      dropped.forEach((toast) => clearToastTimer(toast.id));
      toastsRef.current = next;
      setToasts(next);
      scheduleDismiss(incoming.id);
    },
    [clearToastTimer, scheduleDismiss],
  );

  const toggleFavorite = useCallback(
    (productId: string, productName: string) => {
      const next = new Set(favoriteIds);
      const removing = next.has(productId);
      if (removing) next.delete(productId);
      else next.add(productId);
      writeFavorites([...next]);
      notify(
        removing
          ? `${productName} removido dos favoritos.`
          : `${productName} adicionado aos favoritos.`,
      );
    },
    [favoriteIds, notify],
  );

  return (
    <ShopExperienceContext.Provider
      value={{ favorites, toggleFavorite, notify }}
    >
      {children}
      {drawer !== 'closed' ? (
        <div className="pointer-events-none fixed inset-0 z-[1000] overflow-hidden">
          <div
            className={cn(
              // Sobe bem acima do mobiliário de rodapé: o véu de blur da
              // bottom nav tem 96px de altura e os rodapés de CTA fixo
              // (produto/carrinho) ~72px. 128px deixa os toasts claramente
              // por cima, sem encostar em botão.
              'absolute inset-x-0 bottom-0 flex justify-center px-5 pb-[max(8rem,calc(env(safe-area-inset-bottom,0px)+7rem))] lg:px-8 lg:pb-6',
              drawer === 'closing' ? 'zelo-toast-drawer-out' : 'zelo-toast-drawer-in',
            )}
          >
            <div className="flex w-[90%] max-w-md flex-col gap-1.5">
              {visibleToasts.map((toast) => (
                <div
                  key={toast.id}
                  className={cn(
                    'pointer-events-auto flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-2.5 shadow-lg',
                    toast.type === 'success'
                      ? 'bg-success text-success-foreground'
                      : 'bg-destructive text-primary-foreground',
                  )}
                  role="status"
                >
                  {toast.type === 'success' ? (
                    <CheckCircle2 className="size-[18px] shrink-0" />
                  ) : (
                    <AlertCircle className="size-[18px] shrink-0" />
                  )}
                  <p className="flex-1 break-words text-xs font-semibold">
                    {toast.message}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      visibleToasts.length > 1
                        ? dismissToast(toast.id)
                        : dismissAll()
                    }
                    aria-label="Fechar notificação"
                    className="opacity-80"
                  >
                    <X className="size-[18px]" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </ShopExperienceContext.Provider>
  );
}

export function useShopExperience() {
  const context = useContext(ShopExperienceContext);
  if (!context)
    throw new Error('useShopExperience must be within ShopExperienceProvider');
  return context;
}
