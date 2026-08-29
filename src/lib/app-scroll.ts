/** Container de scroll no mobile (ver `mobileAppShellScrollClass`). */
export const APP_SCROLL_CONTAINER_CLASS = 'app-shell-scroll';

const LG_MEDIA_QUERY = '(min-width: 1024px)';

export function usesDocumentScroll(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia(LG_MEDIA_QUERY).matches;
}

/** Resolve o elemento que rola: `window` no desktop, `.app-shell-scroll` no mobile. */
export function getAppScrollContainer(from?: HTMLElement | null): HTMLElement | Window {
  if (typeof window === 'undefined') return window;
  if (usesDocumentScroll()) return window;

  let node = from?.parentElement ?? null;
  while (node) {
    if (node.classList.contains(APP_SCROLL_CONTAINER_CLASS)) return node;
    node = node.parentElement;
  }

  const fallback = document.querySelector(`.${APP_SCROLL_CONTAINER_CLASS}`);
  return fallback instanceof HTMLElement ? fallback : window;
}

export function getAppScrollTop(container: HTMLElement | Window): number {
  return container === window
    ? window.scrollY
    : (container as HTMLElement).scrollTop;
}

export function scrollAppBy(container: HTMLElement | Window, delta: number): void {
  if (delta === 0) return;
  if (container === window) {
    window.scrollBy(0, delta);
    return;
  }
  (container as HTMLElement).scrollTop += delta;
}
