'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { usePrinter } from '@/contexts/PrinterContext';
import { apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { orderToDeliverySlip, orderToKitchenTicket } from '@/lib/admin/receipt';
import {
  buildDeliverySlip,
  buildKitchenTicket,
} from '@/modules/printing/receipts';
import type { CatalogStore } from '@/modules/catalog/types';
import { nextAdminStatus, type AdminOrderDetail } from '@/modules/admin/types';
import { useAdminOrdersRealtime } from '@/modules/realtime/hooks';

/**
 * Carrega o pedido do admin e o mantém fresco (carga inicial + Realtime em
 * segundo plano), além de encapsular todas as ações da tela: avançar status,
 * cancelar, reenviar estorno Pix e reimprimir comanda/pedido.
 */
export function useAdminOrderDetail(id: string) {
  const { isAuthenticated, ready } = useRequireAdmin();
  const { prompt, alert } = useAppDialog();
  const printer = usePrinter();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { version: realtimeVersion } = useAdminOrdersRealtime(
    ready && isAuthenticated,
  );

  const storeQuery = useQuery({
    queryKey: adminKeys.store(),
    enabled: ready && isAuthenticated,
    queryFn: () =>
      apiJson<{ store: CatalogStore | null }>('/api/v1/admin/store'),
  });

  const loadOrder = useCallback(
    async (opts?: { background?: boolean }) => {
      try {
        const response = await fetch(`/api/v1/admin/orders/${id}`, {
          cache: 'no-store',
        });
        const json = await response.json();
        if (!response.ok) {
          setError(json?.error?.message ?? 'Pedido não encontrado.');
          setOrder(null);
          return;
        }
        setOrder(json.order as AdminOrderDetail);
        setError(null);
      } catch {
        setError('Falha de rede.');
      } finally {
        // Só a carga inicial controla o spinner; refetch de Realtime nunca,
        // senão uma reconexão do socket trava a tela em "carregando".
        if (!opts?.background) setLoading(false);
      }
    },
    [id],
  );

  // Carga inicial: dona do `loading`, roda ao ficar pronto e ao trocar de pedido.
  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    setLoading(true);
    void loadOrder();
  }, [ready, isAuthenticated, loadOrder]);

  // Atualização via Realtime: refetch em segundo plano, sem tocar no `loading`.
  useEffect(() => {
    if (!ready || !isAuthenticated || realtimeVersion === 0) return;
    void loadOrder({ background: true });
  }, [ready, isAuthenticated, realtimeVersion, loadOrder]);

  const advance = async () => {
    if (!order) return;
    const next = nextAdminStatus(order.status, order.deliveryMethod);
    if (!next) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/admin/orders/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus: next }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json?.error?.message ?? 'Não foi possível atualizar.');
        return;
      }
      setOrder(json.order as AdminOrderDetail);
    } catch {
      setError('Falha de rede ao atualizar status.');
    } finally {
      setBusy(false);
    }
  };

  // Chama a rota de cancelamento. Serve tanto para cancelar o pedido quanto,
  // num pedido já cancelado, para reenviar só o estorno do Pix (o backend
  // detecta o estado e faz a coisa certa).
  const postCancel = async (reason: string, netError: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/admin/orders/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json?.error?.message ?? netError);
        return;
      }
      setOrder(json.order as AdminOrderDetail);
      return json.refund as 'done' | 'already' | 'failed' | undefined;
    } catch {
      setError(netError);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!order) return;
    const reason = await prompt({
      title: 'Cancelar pedido',
      description: 'Informe o motivo do cancelamento administrativo.',
      placeholder: 'Motivo do cancelamento',
      minLength: 3,
      confirmLabel: 'Cancelar pedido',
    });
    if (!reason) return;
    const refund = await postCancel(reason, 'Falha de rede ao cancelar.');
    if (refund === 'done') {
      await alert({
        title: 'Pedido cancelado',
        description: 'O estorno do Pix foi solicitado ao Mercado Pago.',
      });
    } else if (refund === 'failed') {
      await alert({
        title: 'Pedido cancelado, mas o estorno falhou',
        description:
          'Reenvie o estorno pelo botão "Tentar estorno do Pix de novo" ou estorne manualmente no painel do Mercado Pago.',
      });
    }
  };

  const reprintTicket = async () => {
    if (!order) return;
    const bytes = buildKitchenTicket(orderToKitchenTicket(order));
    const result = await printer.printRaw(bytes);
    if (!result.ok) setError(result.reason);
  };

  const reprintSlip = async () => {
    const store = storeQuery.data?.store;
    if (!order || !store) return;
    const bytes = buildDeliverySlip(orderToDeliverySlip(order, store));
    const result = await printer.printRaw(bytes);
    if (!result.ok) setError(result.reason);
  };

  const retryRefund = async () => {
    if (!order) return;
    const refund = await postCancel(
      'Reenvio do estorno Pix',
      'Falha de rede ao estornar.',
    );
    if (refund === 'done' || refund === 'already') {
      await alert({
        title: 'Estorno enviado',
        description: 'O estorno do Pix foi enviado ao Mercado Pago.',
      });
    } else if (refund === 'failed') {
      await alert({
        title: 'O estorno falhou de novo',
        description: 'Estorne manualmente pelo painel do Mercado Pago.',
      });
    }
  };

  return {
    ready,
    isAuthenticated,
    order,
    loading,
    busy,
    error,
    hasStore: Boolean(storeQuery.data?.store),
    printerReady: printer.status === 'ready',
    advance,
    cancel,
    retryRefund,
    reprintTicket,
    reprintSlip,
  };
}
