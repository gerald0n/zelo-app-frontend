'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Preferência de UI leve (string) persistida em `localStorage` e lida via
 * `useSyncExternalStore` — mesmo padrão do store de favoritos. Evita
 * `setState` em effect: o 1º render (servidor e cliente) usa o fallback e o
 * valor salvo entra logo após a subscrição, sem descasar a hidratação.
 *
 * O store mantém um `Set` explícito de assinantes e os notifica direto no
 * `write()` — sem isso, uma escrita na própria aba nunca re-renderiza (o
 * `cache` já vale o novo valor quando o listener compara), e o valor só
 * aparece num refresh.
 */
type PrefStore = {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => string;
  write: (value: string) => void;
};

const stores = new Map<string, PrefStore>();

function getStore(key: string, fallback: string): PrefStore {
  const existing = stores.get(key);
  if (existing) return existing;

  const event = `zelo-pref:${key}`;
  const listeners = new Set<() => void>();
  let cache = fallback;

  const read = () => {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  };

  const notify = () => {
    for (const listener of listeners) listener();
  };

  /**
   * Relê o valor persistido e notifica se mudou. Roda na 1ª subscrição (pega
   * o valor salvo pós-hidratação) e quando outra aba escreve (`storage` +
   * evento custom).
   */
  const sync = () => {
    const next = read();
    if (next !== cache) {
      cache = next;
      notify();
    }
  };

  const store: PrefStore = {
    subscribe(onChange) {
      if (listeners.size === 0) {
        window.addEventListener('storage', sync);
        window.addEventListener(event, sync);
      }
      listeners.add(onChange);
      sync();
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) {
          window.removeEventListener('storage', sync);
          window.removeEventListener(event, sync);
        }
      };
    },
    getSnapshot: () => cache,
    write(value: string) {
      if (value === cache) return;
      cache = value;
      try {
        localStorage.setItem(key, value);
      } catch {
        // ignore
      }
      notify();
      // O `storage` não dispara na aba que escreveu — avisa as outras.
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
