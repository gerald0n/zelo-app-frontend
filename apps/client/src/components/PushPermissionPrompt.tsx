'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import { subscribeToPush } from '@/modules/notifications/client';
import { isBlockedPwaPromptPath, isStandaloneDisplay } from '@/lib/pwa-install';
import { cn } from '@/lib/utils';

const DISMISS_KEY = '@zelo/push-prompt-dismissed:v1';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const { dismissedAt } = JSON.parse(raw) as { dismissedAt?: number };
    return (
      typeof dismissedAt === 'number' &&
      Date.now() - dismissedAt < DISMISS_TTL_MS
    );
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify({ dismissedAt: Date.now() }));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * App já instalado (tela inicial) + cliente logado + permissão ainda não
 * decidida: na primeira abertura, pede pra ativar notificações num modal em
 * vez do cliente ter que ir em Conta > Notificações. Precisa do toque no
 * botão — Safari (iOS) ignora `Notification.requestPermission()` chamado sem
 * gesto do usuário, então não dá pra pedir a permissão do navegador sem essa
 * etapa antes.
 */
export function PushPermissionPrompt() {
  const { user, identityReady } = useAuth();
  const { notify } = useShopExperience();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!identityReady || !user) return;
    if (!isStandaloneDisplay()) return;
    if (isBlockedPwaPromptPath(pathname)) return;
    if (!('Notification' in window) || Notification.permission !== 'default') {
      return;
    }
    if (wasDismissedRecently()) return;

    const timer = window.setTimeout(() => setOpen(true), 1_200);
    return () => window.clearTimeout(timer);
  }, [identityReady, user, pathname]);

  if (!open) return null;

  const dismiss = () => {
    markDismissed();
    setOpen(false);
  };

  const enable = async () => {
    setWorking(true);
    const result = await subscribeToPush();
    setWorking(false);
    setOpen(false);
    if (result.ok) {
      notify('Notificações ativadas neste aparelho.', 'success');
      return;
    }
    if (result.reason !== 'denied') markDismissed();
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-foreground/25"
        onClick={dismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-prompt-title"
        aria-describedby="push-prompt-desc"
        className={cn(
          'relative z-10 mx-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] w-full max-w-md',
          'rounded-2xl border border-border bg-card p-5 shadow-xl',
          'sm:mb-0',
        )}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar"
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-[18px]" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-caramel/40 text-caramel-foreground">
            <Bell className="size-6" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Notificações
            </p>
            <h2
              id="push-prompt-title"
              className="mt-0.5 font-serif text-xl font-semibold leading-tight text-foreground"
            >
              Quer acompanhar seu pedido em tempo real?
            </h2>
          </div>
        </div>

        <p
          id="push-prompt-desc"
          className="mt-3 text-sm leading-relaxed text-muted-foreground"
        >
          Avisamos por aqui quando o pedido for pra produção, ficar pronto ou
          sair pra entrega — sem precisar ficar checando.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <Button
            type="button"
            className="h-11 w-full rounded-lg text-sm font-semibold"
            disabled={working}
            onClick={() => void enable()}
          >
            {working ? 'Ativando…' : 'Ativar notificações'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full rounded-lg text-sm font-semibold text-muted-foreground"
            disabled={working}
            onClick={dismiss}
          >
            Agora não
          </Button>
        </div>
      </div>
    </div>
  );
}
