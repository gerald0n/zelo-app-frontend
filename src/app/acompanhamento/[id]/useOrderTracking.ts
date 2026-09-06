'use client';

import { useCallback, useEffect, useState } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { version: realtimeVersion } = useCustomerOrderRealtime(id, true);

  const loadOrder = useCallback(
    async (opts?: { background?: boolean }) => {
      try {
        const response = await fetch(`/api/v1/orders/${id}`, {
          cache: 'no-store',
        });
        const json = await response.json();
        if (!response.ok) {
          setError(json?.error?.message ?? 'Pedido não encontrado.');
          setOrder(null);
          return;
        }
        setOrder(json.order as CustomerOrder);
        setError(null);
      } catch {
        setError('Falha de rede ao carregar o pedido.');
      } finally {
        // Só a carga inicial controla o skeleton; refetch em segundo plano
        // nunca, senão uma oscilação do Realtime trava a tela.
        if (!opts?.background) setLoading(false);
      }
    },
    [id],
  );

  // Carga inicial: dona do `loading`, roda uma vez por pedido.
  useEffect(() => {
    setLoading(true);
    void loadOrder();
  }, [loadOrder]);

  // Fallback periódico caso o Realtime falhe/desconecte — em segundo plano.
  useEffect(() => {
    const fallback = window.setInterval(() => {
      void loadOrder({ background: true });
    }, 45_000);
    return () => window.clearInterval(fallback);
  }, [loadOrder]);

  // Sinal do Realtime: refetch em segundo plano, sem tocar no `loading`.
  useEffect(() => {
    if (realtimeVersion === 0) return;
    void loadOrder({ background: true });
  }, [realtimeVersion, loadOrder]);

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

  return { order, loading, error, reordering, reorder };
}
