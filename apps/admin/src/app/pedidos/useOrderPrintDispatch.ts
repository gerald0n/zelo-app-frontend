'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePrinter } from '@/contexts/PrinterContext';
import { apiJson } from '@/lib/api';
import { playNewOrderChime } from '@/lib/admin/notification-sound';
import { orderToDeliverySlip, orderToKitchenTicket } from '@/lib/admin/receipt';
import {
  buildDeliverySlip,
  buildKitchenTicket,
} from '@/modules/printing/receipts';
import type { CatalogStore } from '@/modules/catalog/types';
import type {
  AdminOrderDetail,
  AdminOrderListItem,
} from '@/modules/admin/types';
import type { OrderStatus } from '@/modules/orders/types';

const DELIVERY_SLIP_STATUSES: OrderStatus[] = [
  'ready_for_delivery',
  'ready_for_pickup',
];

/**
 * Toca o alerta de pedido novo e alimenta a fila de impressão da térmica:
 *
 * - comanda de cozinha para todo pedido que aparece no quadro;
 * - romaneio quando o pedido fica pronto pra entrega/retirada;
 * - ao (re)abrir o painel, varre no servidor os pedidos cuja comanda ainda
 *   não imprimiu (entraram com o app fechado) e os reenfileira.
 *
 * A fila do `PrinterContext` cuida do resto: imprime em ordem quando a
 * impressora está pronta, segura os jobs quando ela cai, e nunca imprime a
 * mesma comanda duas vezes (dedup por pedido + `kitchen_printed_at`).
 */
export function useOrderPrintDispatch(input: {
  ready: boolean;
  isAuthenticated: boolean;
  ordersLoaded: boolean;
  orders: AdminOrderListItem[];
  store: CatalogStore | null | undefined;
}) {
  const { ready, isAuthenticated, ordersLoaded, orders, store } = input;
  const printer = usePrinter();

  const knownIdsRef = useRef<Set<string> | null>(null);
  const knownStatusRef = useRef<Record<string, OrderStatus>>({});
  const reconciledRef = useRef(false);

  // A lista do quadro não traz itens/adicionais nem endereço — busca o pedido
  // completo. Silencioso em qualquer falha: impressão nunca trava o quadro.
  const fetchOrderDetail = useCallback(async (orderId: string) => {
    try {
      const json = await apiJson<{ order: AdminOrderDetail }>(
        `/api/v1/admin/orders/${orderId}`,
      );
      return json.order;
    } catch {
      return null;
    }
  }, []);

  const enqueueKitchenTicket = useCallback(
    async (orderId: string, label: string) => {
      if (printer.isQueued(orderId, 'kitchen')) return;
      const order = await fetchOrderDetail(orderId);
      if (!order) return;
      printer.enqueuePrint({
        kind: 'kitchen',
        orderId,
        label,
        bytes: buildKitchenTicket(orderToKitchenTicket(order)),
      });
    },
    [fetchOrderDetail, printer],
  );

  const enqueueDeliverySlip = useCallback(
    async (orderId: string, label: string) => {
      if (!store || printer.isQueued(orderId, 'delivery')) return;
      const order = await fetchOrderDetail(orderId);
      if (!order) return;
      printer.enqueuePrint({
        kind: 'delivery',
        orderId,
        label,
        bytes: buildDeliverySlip(orderToDeliverySlip(order, store)),
      });
    },
    [fetchOrderDetail, printer, store],
  );

  // Reconciliação com o servidor — uma vez por sessão.
  useEffect(() => {
    if (!ready || !isAuthenticated || reconciledRef.current) return;
    reconciledRef.current = true;
    void (async () => {
      try {
        const { orders: pending } = await apiJson<{
          orders: Array<{ id: string; number: string }>;
        }>('/api/v1/admin/orders/unprinted');
        for (const order of pending) {
          await enqueueKitchenTicket(order.id, order.number);
        }
      } catch {
        // Silencioso — tenta de novo na próxima abertura do painel.
      }
    })();
  }, [ready, isAuthenticated, enqueueKitchenTicket]);

  // Diff contra o fetch anterior: nada dispara no primeiro carregamento.
  useEffect(() => {
    if (!ordersLoaded) return;
    const currentIds = new Set(orders.map((order) => order.id));
    const currentStatus: Record<string, OrderStatus> = {};
    for (const order of orders) currentStatus[order.id] = order.status;

    const previousIds = knownIdsRef.current;
    const previousStatus = knownStatusRef.current;

    if (previousIds) {
      const newOrders = orders.filter((order) => !previousIds.has(order.id));
      if (newOrders.length > 0) playNewOrderChime();

      for (const order of newOrders) {
        void enqueueKitchenTicket(order.id, order.number);
      }
      for (const order of orders) {
        const was = previousStatus[order.id];
        if (
          was &&
          was !== order.status &&
          DELIVERY_SLIP_STATUSES.includes(order.status)
        ) {
          void enqueueDeliverySlip(order.id, order.number);
        }
      }
    }

    knownIdsRef.current = currentIds;
    knownStatusRef.current = currentStatus;
  }, [ordersLoaded, orders, enqueueKitchenTicket, enqueueDeliverySlip]);
}
