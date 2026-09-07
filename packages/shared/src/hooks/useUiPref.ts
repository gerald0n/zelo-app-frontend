'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Preferência de UI leve (string) persistida em `localStorage` e lida via
 * `useSyncExternalStore` — mesmo padrão do store de favoritos. Evita
 * `setState` em effect: o 1º render (servidor e cliente) usa o fallback e o
 * valor salvo entra logo após a subscrição, sem descasar a hidratação.
 */
type PrefStore = {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => string;
};

const stores = new Map<
  string,
  PrefStore & { write: (value: string) => void }
>();

function getStore(key: string, fallback: string) {
  const existing = stores.get(key);
  if (existing) return existing;

  const event = `zelo-pref:${key}`;
  let cache = fallback;

  const read = () => {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  };

  const store = {
    subscribe(onChange: () => void) {
      cache = read();
      const handle = () => {
        const next = read();
        if (next !== cache) {
          cache = next;
          onChange();
        }
      };
      window.addEventListener('storage', handle);
      window.addEventListener(event, handle);
      return () => {
        window.removeEventListener('storage', handle);
        window.removeEventListener(event, handle);
      };
    },
    getSnapshot: () => cache,
    write(value: string) {
      cache = value;
      try {
        localStorage.setItem(key, value);
      } catch {
        // ignore
      }
      window.dispatchEvent(new Event(event));
    },
  };

  stores.set(key, store);
  return store;
}

export function useUiPref(
  key: string,
  fallback: string,
): [string, (value: string) => void] {
  const store = getStore(key, fallback);
  const value = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => fallback,
  );
  const set = useCallback((next: string) => store.write(next), [store]);
  return [value, set];
}
