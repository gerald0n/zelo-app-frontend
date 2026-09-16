import { CART_PERSIST_VERSION, CART_TTL_MS, type CartItem } from '@/modules/carts/types';

export type CartPersisted = {
  version: number;
  updatedAt: number;
  items: CartItem[];
};

export function now() {
  return Date.now();
}

export function isExpired(updatedAt: number) {
  return now() - updatedAt > CART_TTL_MS;
}

/** `migrate` do zustand/persist: zera o carrinho se a versão mudou ou expirou. */
export function migrateCartPersisted(persisted: unknown): CartPersisted {
  const data = persisted as CartPersisted | undefined;
  if (!data || typeof data !== 'object') {
    return { version: CART_PERSIST_VERSION, updatedAt: now(), items: [] };
  }
  if (data.version !== CART_PERSIST_VERSION || isExpired(data.updatedAt)) {
    return { version: CART_PERSIST_VERSION, updatedAt: now(), items: [] };
  }
  return {
    version: CART_PERSIST_VERSION,
    updatedAt: data.updatedAt,
    items: Array.isArray(data.items) ? data.items : [],
  };
}
