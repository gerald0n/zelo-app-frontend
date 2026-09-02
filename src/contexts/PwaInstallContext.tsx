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
import {
  Download,
  EllipsisVertical,
  Share,
  SquarePlus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { registerZeloServiceWorker } from '@/modules/notifications/client';
import { cn } from '@/lib/utils';
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

type PwaInstallContextType = {
  /** PWA ainda pode ser adicionado à tela inicial neste dispositivo. */
  canOfferInstall: boolean;
  openInstallPrompt: () => void;
};

const PwaInstallContext = createContext<PwaInstallContextType | null>(null);

function PwaInstallDialog({
  open,
  mode,
  canNativeInstall,
  installing,
  onDismiss,
  onInstall,
}: {
  open: boolean;
  mode: PwaInstallMode;
  canNativeInstall: boolean;
  installing: boolean;
  onDismiss: () => void;
  onInstall: () => void;
}) {
  if (!open) return null;

  // Assim que o navegador oferece a instalação nativa (`beforeinstallprompt`),
  // mostramos o botão de 1 toque — mesmo se o popup já tinha aberto no modo
  // "passo a passo".
  const showNativeButton = canNativeInstall;
  const showSteps =
    !showNativeButton &&
    (mode === 'ios' || mode === 'android-manual' || mode === 'generic-manual');

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-foreground/25"
        onClick={onDismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-title"
        aria-describedby="pwa-install-desc"
        className={cn(
          'relative z-10 mx-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] w-full max-w-md',
          'rounded-2xl border border-border bg-card p-5 shadow-xl',
          'sm:mb-0',
        )}
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar"
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-[18px]" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-caramel/40 text-caramel-foreground">
            <Download className="size-6" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              App instalável
            </p>
            <h2
              id="pwa-install-title"
              className="mt-0.5 font-serif text-xl font-semibold leading-tight text-foreground"
            >
              Leve a Zelo na tela inicial
            </h2>
          </div>
        </div>

        <p
          id="pwa-install-desc"
          className="mt-3 text-sm leading-relaxed text-muted-foreground"
        >
          A Zelo é um app web (PWA). Com o ícone na tela inicial, o cardápio abre
          mais rápido — sem precisar da loja de apps.
        </p>

        {showSteps && mode === 'ios' ? (
          <ol className="mt-4 space-y-2.5 rounded-xl border border-border bg-secondary/60 p-3.5 text-sm text-foreground">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold text-primary">
                1
              </span>
              <span>
                Toque em{' '}
                <span className="inline-flex items-center gap-1 font-semibold">
                  Compartilhar
                  <Share className="inline size-3.5" aria-hidden />
                </span>{' '}
                na barra do Safari.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold text-primary">
                2
              </span>
              <span>
                Escolha{' '}
                <span className="inline-flex items-center gap-1 font-semibold">
                  Adicionar à Tela de Início
                  <SquarePlus className="inline size-3.5" aria-hidden />
                </span>
                .
              </span>
            </li>
          </ol>
        ) : null}

        {showSteps && mode === 'android-manual' ? (
          <ol className="mt-4 space-y-2.5 rounded-xl border border-border bg-secondary/60 p-3.5 text-sm text-foreground">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold text-primary">
                1
              </span>
              <span>
                Toque no menu{' '}
                <span className="inline-flex items-center gap-1 font-semibold">
                  <EllipsisVertical className="inline size-3.5" aria-hidden />
                  (⋮)
                </span>{' '}
                do Chrome.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold text-primary">
                2
              </span>
              <span>
                Escolha{' '}
                <span className="font-semibold">Adicionar à tela inicial</span>{' '}
                ou <span className="font-semibold">Instalar app</span>.
              </span>
            </li>
          </ol>
        ) : null}

        {showSteps && mode === 'generic-manual' ? (
          <ol className="mt-4 space-y-2.5 rounded-xl border border-border bg-secondary/60 p-3.5 text-sm text-foreground">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold text-primary">
                1
              </span>
              <span>
                Abra o menu{' '}
                <span className="inline-flex items-center gap-1 font-semibold">
                  <EllipsisVertical className="inline size-3.5" aria-hidden />
                  (⋮)
                </span>{' '}
                do navegador.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold text-primary">
                2
              </span>
              <span>
                Procure por{' '}
                <span className="font-semibold">Adicionar à tela inicial</span>{' '}
                ou <span className="font-semibold">Instalar</span>.
              </span>
            </li>
          </ol>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          {showNativeButton ? (
            <Button
              type="button"
              className="h-11 w-full rounded-lg text-sm font-semibold"
              disabled={installing}
              onClick={onInstall}
            >
              {installing ? 'Abrindo instalação…' : 'Adicionar à tela inicial'}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={showSteps ? 'default' : 'ghost'}
            className={cn(
              'h-11 w-full rounded-lg text-sm font-semibold',
              !showSteps && 'text-muted-foreground',
            )}
            onClick={onDismiss}
          >
            {showSteps ? 'Entendi' : 'Agora não'}
          </Button>
        </div>
      </div>
    </div>
  );
}

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

  useEffect(() => {
    setCanOfferInstall(!isStandaloneDisplay());
  }, []);

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
    // Só o app instalado não precisa disto. Mesmo com o convite automático
    // já dispensado, seguimos capturando o `beforeinstallprompt` pra que o
    // botão "Adicionar à tela inicial" (no popup e na tela de Conta)
    // consiga abrir a instalação nativa em vez de só mostrar o passo a passo.
    if (isStandaloneDisplay()) return;

    void registerZeloServiceWorker();

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
