import { useSyncExternalStore } from 'react';

function readSessionItem(key: string): string {
  try {
    return sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

export function useSessionItem(key: string): string {
  return useSyncExternalStore(
    () => () => {},
    () => readSessionItem(key),
    () => '',
  );
}
