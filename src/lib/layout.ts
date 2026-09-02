/*
 * Sem app shell no mobile: o documento rola normalmente (como qualquer site).
 * A tentativa de prender o viewport (`h-[100svh]` + `overflow: hidden` no
 * html/body + container único `[data-app-scroll]`) reintroduzia a "faixa
 * morta" de ~100px no Chrome iOS aberto por link/QR, então foi removida.
 *
 * O bloqueio de zoom continua (viewport + LockMobileZoom). O PWA instalado
 * ganha tela cheia pelo `display: standalone` do manifest.
 */

/** Barra de título das páginas internas (checkout, conta, busca). */
export const pageHeaderBarClass =
  'flex shrink-0 items-center justify-between border-b border-border px-3 pb-2 pt-2.5 max-lg:sticky max-lg:top-0 max-lg:z-30 max-lg:bg-background lg:border-none lg:px-0 lg:pt-5';

/** Padding do corpo nas páginas internas. */
export const pageBodyPadClass = 'px-3 pb-6 pt-3';

/** Inputs de formulário — `text-base` evita zoom horizontal no iOS. */
export const checkoutFieldClass =
  'min-w-0 max-w-full h-10 w-full rounded-md border border-input bg-card px-3 text-base outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40';

/** Rodapé do checkout no fluxo da página (após o conteúdo, rola junto). */
export const checkoutFooterClass = 'mt-4 border-t border-border pt-3';

/** Base dos CTAs das páginas internas (altura/padding unificados). */
export const pageCtaBaseClass =
  'flex h-11 w-full select-none items-center justify-center rounded-md text-sm font-semibold transition-[background-color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background active:scale-[0.99] disabled:pointer-events-none disabled:active:scale-100';

/** CTA principal das páginas internas. */
export const pagePrimaryButtonClass = `${pageCtaBaseClass} bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60`;

/** CTA secundário (contorno) das páginas internas. */
export const pageSecondaryButtonClass = `${pageCtaBaseClass} border border-border bg-card text-foreground hover:bg-accent`;

/**
 * No desktop, o checkout continua em uma única coluna (fluxo de etapas),
 * mas centralizado como um cartão de largura confortável — em vez do
 * fluxo mobile esticado por toda a largura da tela.
 */
export const checkoutDesktopContainerClass =
  'lg:mx-auto lg:w-full lg:max-w-[640px]';

/** Espaço inferior para a navbar flutuante + véu de blur */
export const MOBILE_NAV_PAD_PX = 84;

/** Telas do cliente em que a navbar mobile fica oculta. */
export function shouldHideCustomerMobileNav(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/produto') ||
    pathname.startsWith('/loja') ||
    pathname.startsWith('/carrinho') ||
    pathname.startsWith('/acompanhamento') ||
    pathname.startsWith('/cancelar-pedido') ||
    pathname.startsWith('/checkout')
  );
}
