/*
 * App shell mobile (2026-09-01, 2ª versão).
 *
 * Objetivo: no mobile a experiência é de app — a tela toda é ocupada, o
 * documento NÃO rola (a barra de URL do navegador nunca some/aparece) e o
 * scroll fica num único container interno.
 *
 * A 1ª versão quebrava o layout no Chrome iOS ao abrir via QR Code porque
 * usava `position: fixed; inset: 0` + `html,body{height:100%;overflow:hidden}`.
 * No 1º paint o Chrome iOS resolvia essa altura pelo large viewport (barra
 * escondida) enquanto pintava o small viewport → faixa morta de ~100px.
 *
 * Esta versão evita os dois gatilhos:
 *  - sem `position: fixed` — o shell é um filho normal em fluxo (`flex`);
 *  - altura só em `svh` (small viewport height), que já é bem-definido no 1º
 *    paint e é estável (a barra de URL fica sempre visível, então svh == área
 *    visível o tempo todo). Nunca `%`, `vh` nem `dvh`.
 * O trecho `html,body{overflow:hidden}` vive em `globals.css` (@media mobile).
 */

/** Shell: ocupa 100svh, empilha em coluna, não deixa nada vazar. */
export const mobileAppShellClass =
  'max-lg:flex max-lg:h-[100svh] max-lg:flex-col max-lg:overflow-hidden';

/**
 * Único container que rola no mobile (marcado com `data-app-scroll`).
 * `[&>*]:min-h-full` faz a raiz de cada página preencher exatamente o shell
 * (as páginas usam `min-h-dvh`, que sobraria ~84px sob a navbar flutuante e
 * criaria um scroll fantasma). Desktop mantém `min-h-dvh`.
 */
export const mobileAppShellScrollClass =
  'max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-y-auto max-lg:overscroll-y-contain max-lg:[&>*]:min-h-full';

/**
 * Elemento que rola: `window` no desktop (scroll de documento normal),
 * o container `[data-app-scroll]` no mobile (shell). Reavaliar a cada uso —
 * o breakpoint pode mudar sem recriar o componente.
 */
export function getAppScroller(): HTMLElement | Window {
  if (typeof window === 'undefined') return window;
  if (window.matchMedia('(min-width: 1024px)').matches) return window;
  return document.querySelector<HTMLElement>('[data-app-scroll]') ?? window;
}

/** Posição de scroll do elemento resolvido por `getAppScroller`. */
export function getAppScrollTop(scroller: HTMLElement | Window): number {
  return scroller === window
    ? window.scrollY
    : (scroller as HTMLElement).scrollTop;
}

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
