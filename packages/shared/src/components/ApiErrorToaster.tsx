'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { subscribeApiError } from '@/lib/api-error-bus';
import { randomUUID } from '@/lib/random-id';

const TOAST_MS = 5000;
const MAX_TOASTS = 3;

type ErrorToast = { id: string; message: string };

/**
 * Rede de segurança global: mostra toda falha de query/mutation do React
 * Query (ligado via `emitApiError` no QueryProvider) como toast, mesmo
 * quando a tela que disparou a chamada não trata o erro explicitamente.
 * O client tem seu próprio sistema de toast (ShopExperienceContext); este
 * componente é só para apps sem um — hoje, o admin.
 */
export function ApiErrorToaster() {
  const [toasts, setToasts] = useState<ErrorToast[]>([]);

  useEffect(() => {
    return subscribeApiError((message) => {
      setToasts((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.message === message) return prev;
        const next = [...prev, { id: randomUUID(), message }];
        return next.slice(-MAX_TOASTS);
      });
    });
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const id = toasts[0].id;
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[1000] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <div className="flex w-full max-w-md flex-col gap-1.5">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex w-full items-center gap-2.5 rounded-2xl bg-destructive px-3.5 py-2.5 text-primary-foreground shadow-lg"
          >
            <AlertCircle className="size-[18px] shrink-0" />
            <p className="flex-1 break-words text-xs font-semibold">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() =>
                setToasts((prev) => prev.filter((item) => item.id !== toast.id))
              }
              aria-label="Fechar notificação"
              className="opacity-80"
            >
              <X className="size-[18px]" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
