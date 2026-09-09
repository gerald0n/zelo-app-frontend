'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Rotas do cardápio: dados renderizados no servidor, sem canal ao vivo. Um PWA
 * aberto há horas mostra o menu antigo até a página recarregar de verdade.
 */
function isCatalogRoute(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/loja' ||
    pathname === '/busca' ||
    pathname.startsWith('/produto/')
  );
}

/** Não recarrega de novo se a última atualização foi há menos disto. */
const MIN_INTERVAL_MS = 30_000;

/**
 * Quando a aba/app volta ao foco (ou é restaurado do bfcache) numa rota do
 * cardápio, faz `router.refresh()` — rebusca os Server Components sem perder
 * estado do React nem a posição de scroll. Assim uma mudança do painel
 * (produto esgotado, preço, loja fechada) aparece ao reabrir o app, não só
 * na próxima navegação.
 */
export default function RefreshOnVisible() {
  const router = useRouter();
  const pathname = usePathname();
  // 0 = ainda não recarregou. O primeiro retorno ao foco sempre passa pelo
  // throttle (é o caso que queremos: PWA reaberto depois de um tempo).
  const lastRefresh = useRef(0);

  useEffect(() => {
    if (!isCatalogRoute(pathname)) return;

    const refresh = (force = false) => {
      if (!force && Date.now() - lastRefresh.current < MIN_INTERVAL_MS) return;
      lastRefresh.current = Date.now();
      router.refresh();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    // bfcache (voltar do navegador): a página inteira está congelada e velha.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refresh(true);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [pathname, router]);

  return null;
}
