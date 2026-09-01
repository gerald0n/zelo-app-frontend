'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { AccountAuthGate } from '@/components/account/AccountAuthGate';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import {
  getPushSubscriptionState,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/modules/notifications/client';
import { cn } from '@/lib/cn';
import {
  checkoutDesktopContainerClass,
  pageBodyPadClass,
} from '@/lib/layout';

type PushUiState =
  | 'loading'
  | 'unsupported'
  | 'off'
  | 'denied'
  | 'on'
  | 'working';

export default function NotificacoesPage() {
  const { notify } = useShopExperience();
  const [state, setState] = useState<PushUiState>('loading');

  const refresh = async () => {
    const current = await getPushSubscriptionState();
    if (current.permission === 'unsupported') {
      setState('unsupported');
      return;
    }
    if (current.permission === 'denied') {
      setState('denied');
      return;
    }
    setState(current.subscribed ? 'on' : 'off');
  };

  useEffect(() => {
    void refresh();
  }, []);

  const enable = async () => {
    setState('working');
    const result = await subscribeToPush();
    if (result.ok) {
      notify('Notificações ativadas neste aparelho.', 'success');
      setState('on');
      return;
    }
    if (result.reason === 'denied') {
      setState('denied');
      return;
    }
    if (result.reason === 'unsupported' || result.reason === 'missing_vapid') {
      setState('unsupported');
      notify('Notificações indisponíveis neste navegador.', 'error');
      return;
    }
    setState('off');
    notify('Não foi possível ativar as notificações.', 'error');
  };

  const disable = async () => {
    setState('working');
    const result = await unsubscribeFromPush();
    if (result.ok) {
      notify('Notificações desativadas neste aparelho.', 'success');
      setState('off');
      return;
    }
    await refresh();
    notify('Não foi possível desativar as notificações.', 'error');
  };

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-background">
      <AccountPageHeader title="Notificações" />
      <div className={cn(pageBodyPadClass, checkoutDesktopContainerClass)}>
        <AccountAuthGate
          title="Entre para gerenciar notificações"
          description="As atualizações de pedido são enviadas para o aparelho em que você autorizar."
        >
          <div className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-start gap-3">
              {state === 'on' ? (
                <Bell className="mt-0.5 size-5 text-primary" />
              ) : (
                <BellOff className="mt-0.5 size-5 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold">
                  Avisos do pedido
                </p>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">
                  Receba atualizações quando o pedido for para produção, ficar
                  pronto ou sair para entrega.
                </p>
              </div>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              {state === 'loading' || state === 'working'
                ? 'Verificando permissão…'
                : state === 'on'
                  ? 'Ativadas neste aparelho.'
                  : state === 'denied'
                    ? 'O navegador bloqueou as notificações. Libere em Ajustes para ativar de novo.'
                    : state === 'unsupported'
                      ? 'Este navegador não suporta notificações push. No iPhone, adicione a Zelo à tela inicial.'
                      : 'Desativadas neste aparelho.'}
            </p>

            {state === 'on' ? (
              <button
                type="button"
                onClick={() => void disable()}
                className="mt-4 h-11 w-full rounded-md border border-border text-sm font-semibold"
              >
                Desativar neste aparelho
              </button>
            ) : state === 'off' || state === 'working' || state === 'loading' ? (
              <button
                type="button"
                disabled={state === 'working' || state === 'loading'}
                onClick={() => void enable()}
                className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-semibold text-white disabled:opacity-60"
              >
                Ativar notificações
              </button>
            ) : null}
          </div>
        </AccountAuthGate>
      </div>
    </div>
  );
}
