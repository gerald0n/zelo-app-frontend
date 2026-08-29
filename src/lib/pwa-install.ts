export const PWA_INSTALL_STORAGE_KEY = '@zelo/pwa-install-prompt:v2';
export const PWA_INSTALL_SHOW_DELAY_MS = 12_000;
/** Reexibe o convite automático após dispensar. */
export const PWA_INSTALL_DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type PwaInstallMode =
  | 'native'
  | 'ios'
  | 'android-manual'
  | 'generic-manual';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia('(display-mode: standalone)').matches;
}

export function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs =
    window.navigator.platform === 'MacIntel' &&
    window.navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

export function isAndroidDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android/i.test(window.navigator.userAgent);
}

export function isBlockedPwaPromptPath(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/carrinho') ||
    pathname.startsWith('/acompanhamento') ||
    pathname.startsWith('/cancelar-pedido') ||
    pathname.startsWith('/pedido-recebido')
  );
}

export function wasPwaInstallDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(PWA_INSTALL_STORAGE_KEY);
    if (!raw) return false;
    if (raw === 'dismissed') return true;
    const parsed = JSON.parse(raw) as { dismissedAt?: number };
    if (typeof parsed.dismissedAt !== 'number') return false;
    return Date.now() - parsed.dismissedAt < PWA_INSTALL_DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export function markPwaInstallDismissed(): void {
  try {
    localStorage.setItem(
      PWA_INSTALL_STORAGE_KEY,
      JSON.stringify({ dismissedAt: Date.now() }),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function resolvePwaInstallMode(
  hasNativePrompt: boolean,
): PwaInstallMode | null {
  if (hasNativePrompt) return 'native';
  if (isIosDevice()) return 'ios';
  if (isAndroidDevice()) return 'android-manual';
  return null;
}
