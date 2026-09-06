'use client';

import {
  Download,
  EllipsisVertical,
  Share,
  SquarePlus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PwaInstallMode } from '@/lib/pwa-install';

type Props = {
  open: boolean;
  mode: PwaInstallMode;
  canNativeInstall: boolean;
  installing: boolean;
  onDismiss: () => void;
  onInstall: () => void;
};

function StepBadge({ n }: { n: number }) {
  return (
    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold text-primary">
      {n}
    </span>
  );
}

function StepList({ children }: { children: React.ReactNode }) {
  return (
    <ol className="mt-4 space-y-2.5 rounded-xl border border-border bg-secondary/60 p-3.5 text-sm text-foreground">
      {children}
    </ol>
  );
}

export function PwaInstallDialog({
  open,
  mode,
  canNativeInstall,
  installing,
  onDismiss,
  onInstall,
}: Props) {
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
          <StepList>
            <li className="flex items-start gap-2.5">
              <StepBadge n={1} />
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
              <StepBadge n={2} />
              <span>
                Escolha{' '}
                <span className="inline-flex items-center gap-1 font-semibold">
                  Adicionar à Tela de Início
                  <SquarePlus className="inline size-3.5" aria-hidden />
                </span>
                .
              </span>
            </li>
          </StepList>
        ) : null}

        {showSteps && mode === 'android-manual' ? (
          <StepList>
            <li className="flex items-start gap-2.5">
              <StepBadge n={1} />
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
              <StepBadge n={2} />
              <span>
                Escolha{' '}
                <span className="font-semibold">Adicionar à tela inicial</span>{' '}
                ou <span className="font-semibold">Instalar app</span>.
              </span>
            </li>
          </StepList>
        ) : null}

        {showSteps && mode === 'generic-manual' ? (
          <StepList>
            <li className="flex items-start gap-2.5">
              <StepBadge n={1} />
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
              <StepBadge n={2} />
              <span>
                Procure por{' '}
                <span className="font-semibold">Adicionar à tela inicial</span>{' '}
                ou <span className="font-semibold">Instalar</span>.
              </span>
            </li>
          </StepList>
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
