'use client';

import { useSyncExternalStore } from 'react';

let cachedNow = 0;

function getSnapshot() {
  return cachedNow;
}

function subscribe(onStoreChange: () => void) {
  cachedNow = Date.now();
  const id = window.setInterval(() => {
    cachedNow = Date.now();
    onStoreChange();
  }, 60_000);
  return () => window.clearInterval(id);
}

/** Relógio atual com snapshot estável (getSnapshot deve ser referencialmente estável). */
export function useNow(serverSnapshot: number) {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
}
