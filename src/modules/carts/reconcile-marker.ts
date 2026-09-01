'use client';

/**
 * Marca, por navegador, qual Cliente já teve o carrinho anônimo fundido na
 * conta (reconcile). Sem essa marca durável, cada recarga de página / reabertura
 * do PWA re-executa o reconcile e `mergeCartSyncLines` soma as quantidades de
 * novo, dobrando o carrinho a cada carga.
 */
const RECONCILE_MARKER_KEY = '@zelo/cart-reconciled:v1';

export function getReconciledUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(RECONCILE_MARKER_KEY);
  } catch {
    return null;
  }
}

export function markReconciled(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECONCILE_MARKER_KEY, userId);
  } catch {
    /* localStorage indisponível — segue sem persistir a marca */
  }
}

export function clearReconciledMarker(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(RECONCILE_MARKER_KEY);
  } catch {
    /* ignore */
  }
}
