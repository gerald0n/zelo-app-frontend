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

const TOAST_MS = 2800;
const TOAST_DRAWER_MS = 460;
const MAX_TOASTS = 3;

type ToastKind =
  | 'cart-add'
  | 'cart-remove'
  | 'favorite-add'
  | 'favorite-remove'
  | 'generic';

type ToastItem = {
  id: string;
  type: 'success' | 'error';
  kind: ToastKind;
  count: number;
  names: string[];
  message: string;
};

function parseNotify(message: string): {
  kind: ToastKind;
  count: number;
  names: string[];
} {
  let match = message.match(/^(?:(\d+)× )?(.+) adicionado ao carrinho\.$/);
  if (match) {
    return {
      kind: 'cart-add',
      count: match[1] ? Number(match[1]) : 1,
      names: [],
    };
  }
  match = message.match(/^(.+) adicionado aos favoritos\.$/);
  if (match) return { kind: 'favorite-add', count: 1, names: [match[1]] };
  match = message.match(/^(.+) removido dos favoritos\.$/);
  if (match) return { kind: 'favorite-remove', count: 1, names: [match[1]] };
  match = message.match(/^(?:(\d+)× )?(.+) removido do carrinho\.$/);
  if (match) {
    return {
      kind: 'cart-remove',
      count: match[1] ? Number(match[1]) : 1,
      names: [],
    };
  }
  if (message === 'Itens adicionados ao carrinho.') {
    return { kind: 'cart-add', count: 1, names: [] };
  }
  return { kind: 'generic', count: 1, names: [] };
}

function formatGroupedMessage(
  kind: ToastKind,
  count: number,
  names: string[],
  fallback: string,
): string {
  if (kind === 'cart-add') {
    return count === 1
      ? '1 item adicionado ao carrinho.'
      : `${count} itens adicionados ao carrinho.`;
  }
  if (kind === 'cart-remove') {
    return count === 1
      ? '1 item removido do carrinho.'
      : `${count} itens removidos do carrinho.`;
  }
  if (kind === 'favorite-add') {
    if (count === 1 && names[0]) return `${names[0]} adicionado aos favoritos.`;
    return count === 1
      ? '1 item adicionado aos favoritos.'
      : `${count} itens adicionados aos favoritos.`;
  }
  if (kind === 'favorite-remove') {
    if (count === 1 && names[0]) return `${names[0]} removido dos favoritos.`;
    return count === 1
      ? '1 item removido dos favoritos.'
      : `${count} itens removidos dos favoritos.`;
  }
  return fallback;
}

function canGroup(current: ToastItem, next: ToastItem): boolean {
  return (
    current.type === next.type &&
    current.kind === next.kind &&
    current.kind !== 'generic'
  );
}

type ShopExperienceValue = {
  favorites: Set<string>;
  toggleFavorite: (productId: string, productName: string) => void;
  notify: (message: string, type?: 'success' | 'error') => void;
};

const ShopExperienceContext = createContext<ShopExperienceValue | null>(null);
const FAVORITES_STORAGE_KEY = '@zelo/favorites:v1';
const FAVORITES_EVENT = 'zelo-favorites';
const EMPTY_FAVORITES: string[] = [];

let cachedFavorites: string[] = EMPTY_FAVORITES;

function readFavoritesFromStorage(): string[] {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as string[]) : EMPTY_FAVORITES;
  } catch {
    return EMPTY_FAVORITES;
  }
}

function getFavoritesSnapshot(): string[] {
  return cachedFavorites;
}

function getServerFavoritesSnapshot(): string[] {
  return EMPTY_FAVORITES;
}

function writeFavorites(ids: string[]) {
  const next = ids.length === 0 ? EMPTY_FAVORITES : ids;
  cachedFavorites = next;
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(FAVORITES_EVENT));
}

function subscribeFavorites(onStoreChange: () => void) {
  cachedFavorites = readFavoritesFromStorage();

  const handle = () => {
    const next = readFavoritesFromStorage();
    const same =
      next.length === cachedFavorites.length &&
      next.every((id, index) => id === cachedFavorites[index]);
    if (!same) {
      cachedFavorites = next.length === 0 ? EMPTY_FAVORITES : next;
      onStoreChange();
    }
  };

  window.addEventListener('storage', handle);
  window.addEventListener(FAVORITES_EVENT, handle);
  return () => {
    window.removeEventListener('storage', handle);
    window.removeEventListener(FAVORITES_EVENT, handle);
  };
}

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

  useEffect(() => {
    if (toasts.length > 0) {
      setVisibleToasts(toasts);
      setDrawer('open');
      return;
    }
    setDrawer((current) => (current === 'closed' ? current : 'closing'));
  }, [toasts]);

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
