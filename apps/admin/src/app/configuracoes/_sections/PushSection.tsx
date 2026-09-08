'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import {
  disableAdminPush,
  enableAdminPush,
  getAdminPushState,
} from '@/lib/push-client';

type UiState = 'loading' | 'unsupported' | 'off' | 'denied' | 'on' | 'working';

/** Ativa/desativa a notificação de pedido novo neste aparelho. */
export function PushSection() {
  const [state, setState] = useState<UiState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAdminPushState().then((current) => {
      if (cancelled) return;
      if (current.permission === 'unsupported') setState('unsupported');
      else if (current.permission === 'denied') setState('denied');
      else setState(current.subscribed ? 'on' : 'off');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async () => {
    const current = await getAdminPushState();
    if (current.permission === 'unsupported') return setState('unsupported');
    if (current.permission === 'denied') return setState('denied');
    setState(current.subscribed ? 'on' : 'off');
  };

  const enable = async () => {
    setError(null);
    setState('working');
    const result = await enableAdminPush();
    if (result.ok) return setState('on');
    if (result.reason === 'denied') return setState('denied');
    if (result.reason === 'unsupported' || result.reason === 'missing_vapid') {
      setError(
        result.reason === 'missing_vapid'
          ? 'Chaves VAPID não configuradas no servidor.'
          : 'Este navegador não suporta notificações push.',
      );
      return setState(
        result.reason === 'missing_vapid' ? 'off' : 'unsupported',
      );
    }
    setError('Não foi possível ativar. Tente de novo.');
    setState('off');
  };

  const disable = async () => {
    setState('working');
    await disableAdminPush();
    void refresh();
  };

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-3.5">
      <div className="flex items-start gap-2.5">
        {state === 'on' ? (
          <Bell className="mt-0.5 size-4 text-primary" />
        ) : (
          <BellOff className="mt-0.5 size-4 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Notificações de pedido novo</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Buzina no celular quando entra pedido, mesmo com o painel fechado.
            Ative em cada aparelho que for usar.
          </p>
        </div>
      </div>

      <p className="text-2xs text-muted-foreground">
        {state === 'loading' || state === 'working'
          ? 'Verificando…'
          : state === 'on'
            ? 'Ativadas neste aparelho.'
            : state === 'denied'
              ? 'O navegador bloqueou. Libere as notificações nas configurações do site e tente de novo.'
              : state === 'unsupported'
                ? 'Navegador sem suporte. No iPhone, adicione o painel à tela inicial primeiro.'
                : 'Desativadas neste aparelho.'}
      </p>
      {error ? <p className="text-2xs text-destructive">{error}</p> : null}

      {state === 'on' ? (
        <button
          type="button"
          onClick={() => void disable()}
          className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
        >
          Desativar neste aparelho
        </button>
      ) : state === 'off' || state === 'loading' || state === 'working' ? (
        <button
          type="button"
          disabled={state === 'loading' || state === 'working'}
          onClick={() => void enable()}
          className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          Ativar neste aparelho
        </button>
      ) : null}
    </section>
  );
}
