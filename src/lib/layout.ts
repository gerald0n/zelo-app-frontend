/** Classes compartilhadas — só mobile (max-lg / <1024px) */
export const mobileFixedHeaderClass =
  'max-lg:sticky max-lg:top-0 max-lg:z-30 max-lg:bg-background';

/**
 * Shell de viewport fixo no mobile: o documento não rola (barra do browser
 * estável); o scroll fica em `mobileAppShellScrollClass`.
 */
export const mobileAppShellClass =
  'max-lg:fixed max-lg:inset-0 max-lg:flex max-lg:max-w-full max-lg:flex-col max-lg:overflow-hidden';

export const mobileAppShellScrollClass =
  'app-shell-scroll max-lg:min-h-0 max-lg:min-w-0 max-lg:max-w-full max-lg:flex-1 max-lg:overflow-x-hidden max-lg:overflow-y-auto max-lg:overscroll-y-contain';

/**
 * Página em coluna no mobile: preenche o shell e deixa o scroll no filho
 * (`overflow-y-auto` + `min-h-0`), mantendo headers/CTAs no fluxo.
 */
export const mobilePageColumnClass =
  'max-lg:h-full max-lg:min-h-0 max-lg:min-w-0 max-lg:max-w-full max-lg:overflow-x-hidden max-lg:overflow-hidden';

/** Área rolável interna de páginas em coluna (checkout, conta, etc.). */
export const mobilePageScrollClass =
  'min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain';

/** Barra de título das páginas internas (checkout, conta, busca). */
export const pageHeaderBarClass =
  'flex shrink-0 items-center justify-between border-b border-border px-3 pb-2 pt-2.5 max-lg:sticky max-lg:top-0 max-lg:z-30 max-lg:bg-background lg:border-none lg:px-0 lg:pt-5';

/** Padding do corpo nas páginas internas. */
export const pageBodyPadClass = 'px-3 pb-6 pt-3';

/** Inputs de formulário — `text-base` evita zoom horizontal no iOS. */
export const checkoutFieldClass =
  'min-w-0 max-w-full h-10 w-full rounded-md border border-border bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

/** Rodapé do checkout no fluxo da página (após o conteúdo, rola junto). */
export const checkoutFooterClass = 'mt-4 border-t border-border pt-3';

/** Base dos CTAs das páginas internas (altura/padding unificados). */
export const pageCtaBaseClass =
  'flex h-11 w-full items-center justify-center rounded-md text-sm font-semibold';

/** CTA principal das páginas internas. */
export const pagePrimaryButtonClass = `${pageCtaBaseClass} bg-primary text-primary-foreground disabled:opacity-60`;

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
