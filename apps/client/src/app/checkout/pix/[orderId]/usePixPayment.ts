'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomerOrderRealtime } from '@/modules/realtime/hooks';

export type PixView = {
  orderId: string;
  orderNumber: number;
  totalCents: number;
  status: string;
  paymentStatus: string;
  pix: {
    qrCode: string;
    qrCodeBase64: string;
    ticketUrl: string | null;
    expiresAt: string;
  } | null;
};

type FetchResult = { view: PixView } | { error: string };

/**
 * Estado da cobrança Pix de um pedido: carga inicial + refetch por Realtime +
 * polling de 5s enquanto pendente, relógio do contador, redirecionamento ao
 * confirmar e a regeneração de um código expirado.
 */
export function usePixPayment(orderId: string) {
  const router = useRouter();
  const [view, setView] = useState<PixView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const redirectedRef = useRef(false);

  const { version: realtimeVersion } = useCustomerOrderRealtime(orderId, true);

  // Skeleton = ainda não temos a cobrança e não deu erro. Derivado do render.
  const loading = view === null && error === null;

  // Busca pura: sempre vê o `orderId` atual, não faz setState.
  const fetchPix = useEffectEvent(async (): Promise<FetchResult> => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/pix`, {
        cache: 'no-store',
      });
      const json = await response.json();
      if (!response.ok) {
        return {
          error: json?.error?.message ?? 'Não foi possível carregar o Pix.',
        };
      }
      return { view: json as PixView };
    } catch {
      return { error: 'Falha de rede ao carregar o pagamento.' };
    }
  });

  const applyResult = (result: FetchResult) => {
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setView(result.view);
    setError(null);
  };

  // Carga inicial + refetch por sinal do Realtime.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchPix();
      if (!cancelled) applyResult(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, realtimeVersion]);

  // Fallback: enquanto aguardando pagamento, refetch a cada 5s.
  useEffect(() => {
    if (view?.paymentStatus && view.paymentStatus !== 'pending') return;
    const timer = window.setInterval(() => {
      void (async () => {
        applyResult(await fetchPix());
      })();
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [view?.paymentStatus]);

  // Relógio do contador.
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(tick);
  }, []);

  // Pagamento confirmado → tela de pedido recebido.
  useEffect(() => {
    if (!view || redirectedRef.current) return;
    if (view.paymentStatus === 'confirmed') {
      redirectedRef.current = true;
      router.replace(
        `/pedido-recebido?orderId=${encodeURIComponent(view.orderId)}&orderNumber=${view.orderNumber}`,
      );
    }
  }, [view, router]);

  const regenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/pix`, {
        method: 'POST',
      });
      const json = await response.json();
      if (!response.ok) {
        setError(
          json?.error?.message ?? 'Não foi possível gerar um novo código.',
        );
        return;
      }
      setView(json as PixView);
      setError(null);
    } catch {
      setError('Falha de rede ao gerar um novo código.');
    } finally {
      setRegenerating(false);
    }
  };

  return { view, loading, error, now, regenerating, regenerate, setError };
}
