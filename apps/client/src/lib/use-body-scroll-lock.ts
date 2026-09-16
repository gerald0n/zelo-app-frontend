import { useEffect } from 'react';

/** Trava o scroll do body enquanto `active` — usada por modais/drawers de tela cheia. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}
