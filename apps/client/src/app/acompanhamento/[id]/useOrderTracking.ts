'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/modules/carts';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import type { CustomerOrder } from '@/modules/orders/types';
import { useCustomerOrderRealtime } from '@/modules/realtime/hooks';

/**
 * Carrega o pedido e o mantém fresco: carga inicial (dona do skeleton),
 * fallback periódico e refetch por sinal do Realtime, ambos em segundo plano.
 * Também expõe a recompra ("pedir novamente").
 */
export function useOrderTracking(id: string) {
  const router = useRouter();
  const { replaceItems } = useCart();
  const { notify } = useShopExperience();

  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumpado por `refetch()` (ex.: após enviar avaliação) pra rerodar a carga.
  const [refetchNonce, setRefetchNonce] = useState(0);
  const { version: realtimeVersion } = useCustomerOrderRealtime(id, true);

  // Skeleton = ainda não temos o pedido DESTE id e não deu erro. Derivado do
  // render (não de um effect); refetch em segundo plano nunca o reativa porque
  // `order.id` continua igual, e uma troca de `id` volta a mostrá-lo.
  const loading = order?.id !== id && error === null;

  // Busca pura: sempre vê o `id` atual, não faz setState.
  const fetchOrder = useEffectEvent(
    async (): Promise<{ order: CustomerOrder } | { error: string }> => {
      try {
        const response = await fetch(`/api/v1/orders/${id}`, {
          cache: 'no-store',
        });
        const json = await response.json();
        if (!response.ok) {
          return { error: json?.error?.message ?? 'Pedido não encontrado.' };
        }
        return { order: json.order as CustomerOrder };
      } catch {
        return { error: 'Falha de rede ao carregar o pedido.' };
      }
    },
  );

  const applyResult = (
    result: { order: CustomerOrder } | { error: string },
  ) => {
    if ('error' in result) {
      setError(result.error);
      setOrder(null);
      return;
    }
    setOrder(result.order);
    setError(null);
  };

  // Carga inicial (por pedido) + refetch por sinal do Realtime.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchOrder();
      if (!cancelled) applyResult(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, realtimeVersion, refetchNonce]);

  // Fallback periódico caso o Realtime falhe/desconecte.
  useEffect(() => {
    const fallback = window.setInterval(() => {
      void (async () => {
        const result = await fetchOrder();
        applyResult(result);
      })();
    }, 45_000);
    return () => window.clearInterval(fallback);
  }, []);

  const reorder = async () => {
    if (reordering) return;
    setReordering(true);
    try {
      const response = await fetch(`/api/v1/orders/${id}/reorder`, {
        method: 'POST',
      });
      const json = await response.json();
      if (!response.ok) {
        setReordering(false);
        notify(json?.error?.message ?? 'Não foi possível pedir novamente.');
        return;
      }
      if (!json.items?.length) {
        setReordering(false);
        notify('Nenhum item disponível para recompra.');
        return;
      }
      replaceItems(json.items);
      notify('Itens adicionados ao carrinho.');
      // Sem resetar `reordering`: a navegação desmonta a tela e o botão
      // segue em loading até o carrinho aparecer.
      router.push('/carrinho');
    } catch {
      setReordering(false);
      notify('Falha de rede na recompra.');
    }
  };

  const refetch = () => setRefetchNonce((n) => n + 1);

  return { order, loading, error, reordering, reorder, refetch };
}
