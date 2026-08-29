'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Bell, CheckCircle2, Wrench, ShoppingBag, Bike, Home } from 'lucide-react';
import { subscribeToPush } from '@/modules/notifications/client';

const STEPS = [
  { id: 'received', label: 'Recebido', icon: CheckCircle2 },
  { id: 'production', label: 'Produção', icon: Wrench },
  { id: 'ready', label: 'Pronto', icon: ShoppingBag },
  { id: 'delivery', label: 'Entrega', icon: Bike },
  { id: 'done', label: 'Entregue', icon: Home },
];

function PedidoRecebidoContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const orderNumber = searchParams.get('orderNumber');
  const displayNumber = orderNumber ? `#${orderNumber}` : '#—';
  const trackHref = orderId
    ? `/acompanhamento/${orderId}?from=confirmation`
    : '/pedidos';

  const [pushState, setPushState] = useState<
    'idle' | 'loading' | 'enabled' | 'dismissed' | 'unavailable'
  >('idle');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!('Notification' in window)) {
        setPushState('unavailable');
        return;
      }
      if (Notification.permission === 'granted') {
        setPushState('enabled');
        void subscribeToPush();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const enablePush = async () => {
    setPushState('loading');
    const result = await subscribeToPush();
    if (result.ok) {
      setPushState('enabled');
      return;
    }
    if (result.reason === 'denied' || result.reason === 'unsupported') {
      setPushState('dismissed');
      return;
    }
    setPushState('unavailable');
  };

  return (
    <div className="flex min-h-dvh flex-col items-center bg-background px-4 pt-6">
      <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="size-12 text-primary" />
      </div>

      <h1 className="mb-2 text-center text-xl font-bold tracking-[-0.3px]">
        Pedido {displayNumber} recebido!
      </h1>
      <p className="mb-5 text-center text-sm leading-5 text-muted-foreground">
        A Zelo está analisando seu pedido. Você será notificado assim que ele
        entrar em produção.
      </p>

      <div className="mb-5 w-full rounded-xl border border-border bg-card p-4">
        {STEPS.map((step, i) => {
          const isFirst = i === 0;
          const Icon = step.icon;
          return (
            <div key={step.id} className="flex items-start gap-3.5">
              <div className="flex w-7 flex-col items-center">
                <div
                  className={`flex size-7 items-center justify-center rounded-full border-[1.5px] ${isFirst ? 'border-primary bg-primary' : 'border-border bg-muted'}`}
                >
                  <Icon
                    className={`size-3.5 ${isFirst ? 'text-white' : 'text-muted-foreground'}`}
                  />
                </div>
                {i < STEPS.length - 1 ? (
                  <div className="mt-0.5 h-6 w-[1.5px] bg-border" />
                ) : null}
              </div>
              <p
                className={`pt-1.5 text-sm ${isFirst ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>

      {pushState === 'idle' || pushState === 'loading' ? (
        <div className="mb-6 w-full rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Receba atualizações</p>
              <p className="mt-1 text-xs leading-4 text-muted-foreground">
                Ative as notificações para receber atualizações sobre o andamento
                do seu pedido.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={pushState === 'loading'}
                  onClick={() => void enablePush()}
                  className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {pushState === 'loading' ? 'Ativando…' : 'Ativar notificações'}
                </button>
                <button
                  type="button"
                  disabled={pushState === 'loading'}
                  onClick={() => setPushState('dismissed')}
                  className="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground"
                >
                  Agora não
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {pushState === 'enabled' ? (
        <p className="mb-6 text-center text-xs text-muted-foreground">
          Notificações ativadas para este dispositivo.
        </p>
      ) : null}

      <div className="mt-auto w-full space-y-2 pb-6">
        <Link
          href={trackHref}
          className="block w-full rounded-md bg-primary py-2.5 text-center text-sm font-semibold text-white"
        >
          Acompanhar pedido
        </Link>
        <Link
          href="/"
          className="block w-full py-3 text-center text-base font-medium text-primary"
        >
          Voltar ao cardápio
        </Link>
      </div>
    </div>
  );
}

export default function PedidoRecebidoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </div>
      }
    >
      <PedidoRecebidoContent />
    </Suspense>
  );
}
