'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import Link from 'next/link';
import { Search, Inbox, Loader2, Circle, Plus } from 'lucide-react';
import AdminHeader from '@/components/admin/AdminHeader';
import AdminOrderCard from '@/components/admin/AdminOrderCard';
import AdminOrderKanbanCard from '@/components/admin/AdminOrderKanbanCard';
import AdminKanbanColumn from '@/components/admin/AdminKanbanColumn';
import { Input } from '@/components/ui/input';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { usePrinter } from '@/contexts/PrinterContext';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { ApiError, apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { cn } from '@/lib/cn';
import { BOARD_COLUMNS, type BoardKind } from '@/lib/admin/order-columns';
import { playNewOrderChime } from '@/lib/admin/notification-sound';
import { orderToDeliverySlip, orderToKitchenTicket } from '@/lib/admin/receipt';
import { buildDeliverySlip, buildKitchenTicket } from '@/modules/printing/receipts';
import type { CatalogStore } from '@/modules/catalog/types';
import {
  nextAdminStatus,
  type AdminOrderDetail,
  type AdminOrderListItem,
} from '@/modules/admin/types';
import { statusLabel, type OrderStatus } from '@/modules/orders/types';
import { useAdminOrdersRealtime } from '@/modules/realtime/hooks';

const DELIVERY_SLIP_STATUSES: OrderStatus[] = [
  'ready_for_delivery',
  'ready_for_pickup',
];

type Board = BoardKind | 'agenda';

const BOARD_LABELS: Record<Board, string> = {
  pickup: 'Retirada',
  delivery: 'Delivery',
  agenda: 'Agenda',
};

export default function AdminPedidosPage() {
  const queryClient = useQueryClient();
  const { prompt } = useAppDialog();
  const printer = usePrinter();
  const { isAuthenticated, ready } = useRequireAdmin();
  const [board, setBoard] = useState<Board>('pickup');
  const [query, setQuery] = useState('');
  const [hideDelivered, setHideDelivered] = useState(false);
  const [mobileStatus, setMobileStatus] = useState<OrderStatus | null>(null);
  const [optimisticStatus, setOptimisticStatus] = useState<
    Record<string, OrderStatus>
  >({});
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const knownIdsRef = useRef<Record<string, Set<string>>>({});
  const knownStatusRef = useRef<Record<string, Record<string, OrderStatus>>>(
    {},
  );

  const { version: realtimeVersion, status: realtimeStatus } =
    useAdminOrdersRealtime(ready && isAuthenticated);

  const storeQuery = useQuery({
    queryKey: adminKeys.store(),
    enabled: ready && isAuthenticated,
    queryFn: () =>
      apiJson<{ store: CatalogStore | null }>('/api/v1/admin/store'),
  });

  const scope = board === 'agenda' ? 'scheduled' : 'all';
  const ordersQuery = useQuery({
    queryKey: [...adminKeys.orders(scope, query.trim()), realtimeVersion],
    enabled: ready && isAuthenticated,
    queryFn: async () => {
      const params = new URLSearchParams({ scope });
      if (query.trim()) params.set('q', query.trim());
      return apiJson<{ orders: AdminOrderListItem[] }>(
        `/api/v1/admin/orders?${params}`,
      );
    },
  });

  const allOrders = useMemo(
    () => ordersQuery.data?.orders ?? [],
    [ordersQuery.data],
  );

  // Busca o pedido completo (a lista do kanban não tem itens/adicionais
  // nem endereço) e manda pra impressora — silencioso em qualquer falha,
  // nunca deve travar o quadro.
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

  const printKitchenTicket = useCallback(
    async (orderId: string) => {
      const order = await fetchOrderDetail(orderId);
      if (!order) return;
      await printer.printRaw(buildKitchenTicket(orderToKitchenTicket(order)));
    },
    [fetchOrderDetail, printer],
  );

  const printDeliverySlip = useCallback(
    async (orderId: string) => {
      const store = storeQuery.data?.store;
      if (!store) return;
      const order = await fetchOrderDetail(orderId);
      if (!order) return;
      await printer.printRaw(
        buildDeliverySlip(orderToDeliverySlip(order, store)),
      );
    },
    [fetchOrderDetail, printer, storeQuery.data],
  );

  // Som + comanda de pedido novo, e impressão do pedido ao ficar pronto —
  // compara com o fetch anterior do mesmo escopo, sem disparar nada no
  // primeiro carregamento.
  useEffect(() => {
    if (!ordersQuery.data) return;
    const currentIds = new Set(allOrders.map((order) => order.id));
    const currentStatus: Record<string, OrderStatus> = {};
    for (const order of allOrders) currentStatus[order.id] = order.status;

    const previousIds = knownIdsRef.current[scope];
    const previousStatus = knownStatusRef.current[scope];

    if (previousIds) {
      const newIds = [...currentIds].filter((id) => !previousIds.has(id));
      if (newIds.length > 0) playNewOrderChime();

      if (printer.status === 'ready') {
        for (const id of newIds) {
          void printKitchenTicket(id);
        }
        if (previousStatus) {
          for (const order of allOrders) {
            const was = previousStatus[order.id];
            if (
              was &&
              was !== order.status &&
              DELIVERY_SLIP_STATUSES.includes(order.status)
            ) {
              void printDeliverySlip(order.id);
            }
          }
        }
      }
    }

    knownIdsRef.current[scope] = currentIds;
    knownStatusRef.current[scope] = currentStatus;
  }, [
    ordersQuery.data,
    allOrders,
    scope,
    printer.status,
    printKitchenTicket,
    printDeliverySlip,
  ]);

  const displayStatusFor = (order: AdminOrderListItem): OrderStatus =>
    optimisticStatus[order.id] ?? order.status;

  const invalidateOrders = () =>
    queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'orders'] });

  const advanceMutation = useMutation({
    mutationFn: async (input: { orderId: string; newStatus: OrderStatus }) =>
      apiJson(`/api/v1/admin/orders/${input.orderId}/status`, {
        method: 'POST',
        body: JSON.stringify({ newStatus: input.newStatus }),
      }),
    onMutate: (input) => {
      setBusyOrderId(input.orderId);
      setActionError('');
      setOptimisticStatus((prev) => ({
        ...prev,
        [input.orderId]: input.newStatus,
      }));
    },
    onError: (error, input) => {
      setOptimisticStatus((prev) => {
        const next = { ...prev };
        delete next[input.orderId];
        return next;
      });
      setActionError(
        error instanceof ApiError ? error.message : 'Falha ao avançar pedido.',
      );
    },
    onSettled: async (_data, _error, input) => {
      setBusyOrderId(null);
      setOptimisticStatus((prev) => {
        const next = { ...prev };
        delete next[input.orderId];
        return next;
      });
      await invalidateOrders();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (input: { orderId: string; reason: string }) =>
      apiJson(`/api/v1/admin/orders/${input.orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: input.reason }),
      }),
    onMutate: (input) => {
      setBusyOrderId(input.orderId);
      setActionError('');
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiError ? error.message : 'Falha ao cancelar pedido.',
      );
    },
    onSettled: async () => {
      setBusyOrderId(null);
      await invalidateOrders();
    },
  });

  const handleAdvance = (order: AdminOrderListItem, newStatus: OrderStatus) => {
    advanceMutation.mutate({ orderId: order.id, newStatus });
  };

  const handleCancel = async (order: AdminOrderListItem) => {
    const reason = await prompt({
      title: `Cancelar ${order.number}`,
      description: 'Explique o motivo — o cliente pode ver essa mensagem.',
      placeholder: 'Ex.: Cliente desistiu, item em falta…',
      confirmLabel: 'Cancelar pedido',
      minLength: 3,
    });
    if (!reason) return;
    cancelMutation.mutate({ orderId: order.id, reason });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const orderId = String(event.active.id);
    const targetStatus = event.over?.id as OrderStatus | undefined;
    if (!targetStatus) return;

    const order = allOrders.find((item) => item.id === orderId);
    if (!order) return;

    const expectedNext = nextAdminStatus(order.status, order.deliveryMethod);
    if (!expectedNext || expectedNext !== targetStatus) return;

    handleAdvance(order, expectedNext);
  };

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 6 },
    }),
  );

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background lg:pl-52">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const boardOrders =
    board === 'agenda'
      ? allOrders
          .filter((order) => order.status === 'received')
          .sort(
            (a, b) =>
              new Date(a.scheduledFor ?? a.createdAt).getTime() -
              new Date(b.scheduledFor ?? b.createdAt).getTime(),
          )
      : allOrders.filter(
          (order) =>
            order.deliveryMethod === board &&
            !(order.timing === 'scheduled' && order.status === 'received'),
        );

  const columns =
    board === 'agenda'
      ? []
      : BOARD_COLUMNS[board].filter(
          (status) => !hideDelivered || status !== 'delivered',
        );

  const mobileColumns = columns;
  const activeMobileStatus =
    mobileStatus && mobileColumns.includes(mobileStatus)
      ? mobileStatus
      : (mobileColumns[0] ?? null);

  return (
    <div className="min-h-dvh bg-background lg:pl-52">
      <AdminHeader title="Pedidos" subtitle="Quadro ao vivo" />
      <div className="space-y-2.5 p-3 md:px-6 md:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Circle
              className={cn(
                'size-2.5',
                realtimeStatus === 'subscribed'
                  ? 'fill-success text-success'
                  : 'fill-muted-foreground text-muted-foreground',
              )}
            />
            <span className="text-2xs font-medium text-muted-foreground">
              {realtimeStatus === 'subscribed' ? 'Ao vivo' : 'Conectando…'}
            </span>
          </div>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {(['pickup', 'delivery', 'agenda'] as Board[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setBoard(item)}
                className={cn(
                  'shrink-0 rounded-md border px-3 py-1.5 text-2xs font-semibold',
                  board === item
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-card',
                )}
              >
                {BOARD_LABELS[item]}
              </button>
            ))}
          </div>
          <Link
            href="/admin/pedidos/novo"
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97]"
          >
            <Plus className="size-3.5" />
            Nova comanda
          </Link>
        </div>

        <div className="flex h-11 items-center gap-2 rounded-lg border border-border px-3">
          <Search className="size-[18px] text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Número, cliente ou produto"
            className="h-auto flex-1 border-none bg-transparent p-0 text-sm shadow-none outline-none focus-visible:ring-0"
          />
        </div>

        {board !== 'agenda' ? (
          <label className="flex items-center gap-2 text-2xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={hideDelivered}
              onChange={(e) => setHideDelivered(e.target.checked)}
            />
            Ocultar entregues
          </label>
        ) : null}

        {actionError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {actionError}
          </p>
        ) : null}
      </div>

      {ordersQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : board === 'agenda' ? (
        <div className="space-y-2.5 px-3 pb-7 md:px-6">
          {boardOrders.length ? (
            boardOrders.map((order) => (
              <div key={order.id} className="relative">
                <AdminOrderCard order={order} />
                <button
                  type="button"
                  disabled={busyOrderId === order.id}
                  onClick={() =>
                    handleAdvance(
                      order,
                      nextAdminStatus(order.status, order.deliveryMethod)!,
                    )
                  }
                  className="mt-1.5 w-full rounded-md bg-primary py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Passar para produção
                </button>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center gap-2 pt-[70px]">
              <Inbox className="size-[34px] text-muted-foreground" />
              <p className="text-sm font-semibold">Nada agendado</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Desktop: quadro completo, colunas lado a lado. Drag-and-drop só
              existe aqui — a lista mobile abaixo não fica dentro do
              DndContext, então toques nela nunca são interceptados pelos
              sensores de arraste. */}
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="hidden gap-3 overflow-x-auto px-3 pb-7 lg:flex lg:px-6">
              {columns.map((status) => (
                <AdminKanbanColumn
                  key={status}
                  status={status}
                  orders={boardOrders.filter(
                    (order) => displayStatusFor(order) === status,
                  )}
                  displayStatusFor={displayStatusFor}
                  onAdvance={handleAdvance}
                  onCancel={handleCancel}
                  busyOrderId={busyOrderId}
                />
              ))}
            </div>
          </DndContext>

          {/* Mobile: um status por vez, em lista (decisão do 103). */}
          <div className="space-y-2.5 px-3 pb-7 lg:hidden">
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {mobileColumns.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setMobileStatus(status)}
                  className={cn(
                    'shrink-0 rounded-md border px-3 py-1.5 text-2xs font-semibold',
                    activeMobileStatus === status
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-card',
                  )}
                >
                  {statusLabel(status)} (
                  {
                    boardOrders.filter(
                      (order) => displayStatusFor(order) === status,
                    ).length
                  }
                  )
                </button>
              ))}
            </div>
            {activeMobileStatus ? (
              <div className="space-y-2.5">
                {boardOrders
                  .filter(
                    (order) => displayStatusFor(order) === activeMobileStatus,
                  )
                  .map((order) => (
                    <AdminOrderKanbanCard
                      key={order.id}
                      order={order}
                      displayStatus={displayStatusFor(order)}
                      onAdvance={handleAdvance}
                      onCancel={handleCancel}
                      busy={busyOrderId === order.id}
                      draggable={false}
                    />
                  ))}
                {boardOrders.filter(
                  (order) => displayStatusFor(order) === activeMobileStatus,
                ).length === 0 ? (
                  <div className="flex flex-col items-center gap-2 pt-[70px]">
                    <Inbox className="size-[34px] text-muted-foreground" />
                    <p className="text-sm font-semibold">
                      Nenhum pedido nessa coluna
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
