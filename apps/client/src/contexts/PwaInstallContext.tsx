'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import { registerZeloServiceWorker } from '@/modules/notifications/client';
import {
  type BeforeInstallPromptEvent,
  type PwaInstallMode,
  isAndroidDevice,
  isBlockedPwaPromptPath,
  isIosDevice,
  isStandaloneDisplay,
  markPwaInstallDismissed,
  PWA_INSTALL_SHOW_DELAY_MS,
  resolvePwaInstallMode,
  wasPwaInstallDismissedRecently,
} from '@/lib/pwa-install';
import { PwaInstallDialog } from '@/contexts/pwa-install/PwaInstallDialog';

type PwaInstallContextType = {
  /** PWA ainda pode ser adicionado à tela inicial neste dispositivo. */
  canOfferInstall: boolean;
  openInstallPrompt: () => void;
};

const PwaInstallContext = createContext<PwaInstallContextType | null>(null);

export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PwaInstallMode>('native');
  const [canNativeInstall, setCanNativeInstall] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [canOfferInstall, setCanOfferInstall] = useState(false);

  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const autoShownRef = useRef(false);
  const delayReadyRef = useRef(false);
  const pathnameRef = useRef(pathname);
  const manualOpenRef = useRef(false);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const dismiss = useCallback(() => {
    markPwaInstallDismissed();
    manualOpenRef.current = false;
    setOpen(false);
  }, []);

  const showPrompt = useCallback(
    (nextMode: PwaInstallMode, options?: { manual?: boolean }) => {
      if (isStandaloneDisplay()) return;

      if (options?.manual) {
        manualOpenRef.current = true;
        setMode(nextMode);
        setOpen(true);
        return;
      }

      if (autoShownRef.current || wasPwaInstallDismissedRecently()) return;
      if (isBlockedPwaPromptPath(pathnameRef.current)) return;

      autoShownRef.current = true;
      setMode(nextMode);
      setOpen(true);
    },
    [],
  );

  const openInstallPrompt = useCallback(() => {
    if (isStandaloneDisplay()) return;

    const nextMode =
      resolvePwaInstallMode(Boolean(deferredPromptRef.current)) ??
      (isIosDevice()
        ? 'ios'
        : isAndroidDevice()
          ? 'android-manual'
          : 'generic-manual');

    showPrompt(nextMode, { manual: true });
  }, [showPrompt]);

  const tryAutoShow = useCallback(() => {
    const nextMode = resolvePwaInstallMode(
      Boolean(deferredPromptRef.current),
    );
    if (!nextMode) return;
    showPrompt(nextMode);
  }, [showPrompt]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Pré-registra sempre, mesmo já instalado — se não, a primeira ativação
    // de notificações (tela de Conta) teria que registrar o SW e assinar o
    // push na mesma interação, "a frio", o que falha silenciosamente em
    // vários navegadores. Rodar isto aqui deixa o SW pronto bem antes do
    // usuário chegar em "Ativar notificações".
    void registerZeloServiceWorker();

    // O resto (captura de `beforeinstallprompt`) o app instalado não precisa.
    // Mesmo com o convite automático já dispensado, seguimos capturando pra
    // que o botão "Adicionar à tela inicial" (no popup e na tela de Conta)
    // consiga abrir a instalação nativa em vez de só mostrar o passo a passo.
    if (isStandaloneDisplay()) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setCanNativeInstall(true);
      setCanOfferInstall(true);
      // `tryAutoShow` → `showPrompt` já respeita o "dispensado há pouco".
      if (delayReadyRef.current) {
        tryAutoShow();
      }
    };

    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setCanNativeInstall(false);
      setCanOfferInstall(false);
      markPwaInstallDismissed();
      manualOpenRef.current = false;
      setOpen(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    // Reflete uma capacidade do navegador só conhecível pós-mount (display-mode
    // não é SSR-safe): não está instalado como app → pode oferecer "adicionar
    // à tela inicial". No iOS o `beforeinstallprompt` nunca dispara, então este
    // é o único caminho para `true` lá — não dá pra derivar no render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanOfferInstall(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [tryAutoShow]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandaloneDisplay() || wasPwaInstallDismissedRecently()) return;

    const timer = window.setTimeout(() => {
      delayReadyRef.current = true;
      if (isStandaloneDisplay() || wasPwaInstallDismissedRecently()) return;
      if (autoShownRef.current) return;
      if (isBlockedPwaPromptPath(pathnameRef.current)) return;
      tryAutoShow();
    }, PWA_INSTALL_SHOW_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [tryAutoShow]);

  useEffect(() => {
    if (autoShownRef.current || open) return;
    if (!delayReadyRef.current) return;
    if (isStandaloneDisplay() || wasPwaInstallDismissedRecently()) return;
    if (isBlockedPwaPromptPath(pathname)) return;

    const nextMode = resolvePwaInstallMode(
      Boolean(deferredPromptRef.current),
    );
    if (!nextMode) return;

    const timer = window.setTimeout(() => showPrompt(nextMode), 1_500);
    return () => window.clearTimeout(timer);
  }, [pathname, open, showPrompt]);

  const handleInstall = async () => {
    const deferred = deferredPromptRef.current;
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      deferredPromptRef.current = null;
      setCanNativeInstall(false);
      if (choice.outcome === 'accepted') {
        markPwaInstallDismissed();
        manualOpenRef.current = false;
        setOpen(false);
        setCanOfferInstall(false);
      } else {
        dismiss();
      }
    } catch {
      dismiss();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <PwaInstallContext.Provider value={{ canOfferInstall, openInstallPrompt }}>
      {children}
      <PwaInstallDialog
        open={open}
        mode={mode}
        canNativeInstall={canNativeInstall}
        installing={installing}
        onDismiss={dismiss}
        onInstall={() => void handleInstall()}
      />
    </PwaInstallContext.Provider>
  );
}

export function usePwaInstall() {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) {
    throw new Error('usePwaInstall must be used within PwaInstallProvider');
  }
  return ctx;
}
