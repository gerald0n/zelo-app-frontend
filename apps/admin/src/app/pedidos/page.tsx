'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Plus, Search, Loader2 } from 'lucide-react';
import AdminKanbanBoard from '@/components/admin/kanban/AdminKanbanBoard';
import AdminKanbanMobile from '@/components/admin/kanban/AdminKanbanMobile';
import AdminOrderDetailModal from '@/components/admin/kanban/AdminOrderDetailModal';
import { Input } from '@/components/ui/input';
import { useNewOrder } from '@/contexts/AdminNewOrderContext';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { usePrinter } from '@/contexts/PrinterContext';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useUiPref } from '@/hooks/useUiPref';
import { ApiError, apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { playNewOrderChime } from '@/lib/admin/notification-sound';
import { orderToDeliverySlip, orderToKitchenTicket } from '@/lib/admin/receipt';
import {
  buildDeliverySlip,
  buildKitchenTicket,
} from '@/modules/printing/receipts';
import type { CatalogStore } from '@/modules/catalog/types';
import {
  type AdminOrderDetail,
  type AdminOrderListItem,
} from '@/modules/admin/types';
import { type OrderStatus } from '@/modules/orders/types';

const DELIVERY_SLIP_STATUSES: OrderStatus[] = [
  'ready_for_delivery',
  'ready_for_pickup',
];

export default function AdminPedidosPage() {
  const queryClient = useQueryClient();
  const { prompt } = useAppDialog();
  const { open: openNewOrder } = useNewOrder();
  const printer = usePrinter();
  const { isAuthenticated, ready } = useRequireAdmin();
  const [query, setQuery] = useState('');
  // Persistido por aparelho: sobrevive a refresh / reabertura do PWA.
  const [hideDeliveredPref, setHideDeliveredPref] = useUiPref(
    'pedidos:hide-delivered',
    '0',
  );
  const hideDelivered = hideDeliveredPref === '1';
  const [optimisticStatus, setOptimisticStatus] = useState<
    Record<string, OrderStatus>
  >({});
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const knownIdsRef = useRef<Set<string> | null>(null);
  const knownStatusRef = useRef<Record<string, OrderStatus>>({});

  const storeQuery = useQuery({
    queryKey: adminKeys.store(),
    enabled: ready && isAuthenticated,
    queryFn: () =>
      apiJson<{ store: CatalogStore | null }>('/api/v1/admin/store'),
  });

  const ordersQuery = useQuery({
    // Realtime invalida esta query pelo `AdminRealtimeProvider` (não vai no
    // queryKey — senão troca a identidade e pisca o spinner a cada evento).
    queryKey: adminKeys.orders('all', query.trim()),
    enabled: ready && isAuthenticated,
    queryFn: async () => {
      const params = new URLSearchParams({ scope: 'all' });
      if (query.trim()) params.set('q', query.trim());
      return apiJson<{ orders: AdminOrderListItem[] }>(
        `/api/v1/admin/orders?${params}`,
      );
    },
    // Ao digitar na busca a queryKey muda — mantém o quadro anterior na tela
    // enquanto a nova lista carrega, em vez de cair no spinner de tela cheia.
    placeholderData: keepPreviousData,
  });

  const allOrders = useMemo(
    () => ordersQuery.data?.orders ?? [],
    [ordersQuery.data],
  );

  // Busca o pedido completo (a lista do quadro não tem itens/adicionais nem
  // endereço) e manda pra impressora — silencioso em qualquer falha, nunca
  // deve travar o quadro.
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
  // compara com o fetch anterior, sem disparar nada no primeiro carregamento.
  useEffect(() => {
    if (!ordersQuery.data) return;
    const currentIds = new Set(allOrders.map((order) => order.id));
    const currentStatus: Record<string, OrderStatus> = {};
    for (const order of allOrders) currentStatus[order.id] = order.status;

    const previousIds = knownIdsRef.current;
    const previousStatus = knownStatusRef.current;

    if (previousIds) {
      const newIds = [...currentIds].filter((id) => !previousIds.has(id));
      if (newIds.length > 0) playNewOrderChime();

      if (printer.status === 'ready') {
        for (const id of newIds) {
          void printKitchenTicket(id);
        }
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

    knownIdsRef.current = currentIds;
    knownStatusRef.current = currentStatus;
  }, [
    ordersQuery.data,
    allOrders,
    printer.status,
    printKitchenTicket,
    printDeliverySlip,
  ]);

  const displayStatusFor = useCallback(
    (order: AdminOrderListItem): OrderStatus =>
      optimisticStatus[order.id] ?? order.status,
    [optimisticStatus],
  );

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

  const handleAdvance = useCallback(
    (order: AdminOrderListItem, newStatus: OrderStatus) => {
      advanceMutation.mutate({ orderId: order.id, newStatus });
    },
    [advanceMutation],
  );

  const handleCancel = useCallback(
    async (order: AdminOrderListItem) => {
      const reason = await prompt({
        title: `Cancelar ${order.number}`,
        description: 'Explique o motivo — o cliente pode ver essa mensagem.',
        placeholder: 'Ex.: Cliente desistiu, item em falta…',
        confirmLabel: 'Cancelar pedido',
        minLength: 3,
      });
      if (!reason) return;
      cancelMutation.mutate({ orderId: order.id, reason });
    },
    [prompt, cancelMutation],
  );

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh bg-background lg:h-dvh lg:overflow-hidden">
      <div className="fixed inset-x-3 top-3 z-30 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end lg:inset-x-auto lg:right-8">
        <div className="flex h-10 items-center gap-2 rounded-full border border-border bg-card/85 px-4 shadow-lg backdrop-blur sm:w-72">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Número, cliente ou produto"
            className="h-auto flex-1 border-none bg-transparent p-0 text-sm shadow-none outline-none focus-visible:ring-0"
          />
        </div>
        <label className="flex h-10 items-center gap-2 self-start rounded-full border border-border bg-card/85 px-4 text-2xs font-medium text-muted-foreground shadow-lg backdrop-blur sm:self-auto">
          <input
            type="checkbox"
            checked={hideDelivered}
            onChange={(e) => setHideDeliveredPref(e.target.checked ? '1' : '0')}
          />
          Ocultar entregues
        </label>
      </div>

      {actionError ? (
        <p className="fixed inset-x-3 top-[76px] z-30 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive shadow-lg backdrop-blur sm:inset-x-auto sm:right-8 sm:max-w-sm">
          {actionError}
        </p>
      ) : null}

      {ordersQuery.isLoading ? (
        <div className="flex min-h-dvh items-center justify-center lg:h-full">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <AdminKanbanBoard
            orders={allOrders}
            displayStatusFor={displayStatusFor}
            onAdvance={handleAdvance}
            onCancel={handleCancel}
            onOpenOrder={setDetailOrderId}
            busyOrderId={busyOrderId}
            hideDelivered={hideDelivered}
          />
          <AdminKanbanMobile
            orders={allOrders}
            displayStatusFor={displayStatusFor}
            onAdvance={handleAdvance}
            onCancel={handleCancel}
            onOpenOrder={setDetailOrderId}
            busyOrderId={busyOrderId}
            hideDelivered={hideDelivered}
          />
        </>
      )}

      <AdminOrderDetailModal
        orderId={detailOrderId}
        onClose={() => setDetailOrderId(null)}
      />

      <button
        type="button"
        onClick={openNewOrder}
        aria-label="Nova comanda"
        className="fixed bottom-[calc(84px+env(safe-area-inset-bottom,0px))] right-4 z-30 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform active:scale-95 lg:hidden"
      >
        <Plus className="size-5" />
      </button>
    </div>
  );
}
