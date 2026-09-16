const SESSION_KEY = '@zelo/promo-banner:esfirras:v1';

/** Palavra usada tanto na URL (`?categoria=`) quanto no match por nome da categoria. */
export const PROMO_BANNER_CATEGORY_QUERY = 'esfirras';
export const PROMO_BANNER_CATEGORY_PARAM = 'categoria';
export const PROMO_BANNER_CATEGORY_HREF = `/?${PROMO_BANNER_CATEGORY_PARAM}=${PROMO_BANNER_CATEGORY_QUERY}`;

function normalizeCategoryText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Casa o parâmetro da URL com o nome da categoria por substring (não
 * exato): cobre variações como "Esfirras" ou "Esfirras Artesanais" sem
 * depender de slug/id fixo no catálogo.
 */
export function matchesPromoBannerCategory(categoryName: string): boolean {
  return normalizeCategoryText(categoryName).includes(
    normalizeCategoryText(PROMO_BANNER_CATEGORY_QUERY),
  );
}

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
