const SESSION_KEY = '@zelo/promo-banner:esfirras:v1';

/**
 * `sessionStorage` (não `localStorage`): o banner deve reaparecer a cada
 * "abertura do app" (nova aba/sessão), só não repetir a cada navegação
 * dentro da mesma sessão.
 */
export function wasPromoBannerShownThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function markPromoBannerShown(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // ignore quota / private mode
  }
}

export function isPromoBannerBlockedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/carrinho') ||
    pathname.startsWith('/acompanhamento') ||
    pathname.startsWith('/cancelar-pedido') ||
    pathname.startsWith('/pedido-recebido')
  );
}
