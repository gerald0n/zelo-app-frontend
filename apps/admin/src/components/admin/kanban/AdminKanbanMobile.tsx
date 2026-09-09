'use client';

import { useMemo } from 'react';
import { Inbox } from 'lucide-react';
import { useUiPref } from '@/hooks/useUiPref';
import type { AdminOrderListItem } from '@/modules/admin/types';
import type { OrderStatus } from '@/modules/orders/types';
import {
  LANES,
  type BoardColumn,
  type LaneKey,
  columnOf,
  columnShortLabel,
  columnsForLane,
  laneOf,
} from '@/lib/admin/kanban-board';
import AdminOrderCardBody from '@/components/admin/kanban/AdminOrderCardBody';
import { cn } from '@/lib/cn';

type Props = {
  orders: AdminOrderListItem[];
  displayStatusFor: (order: AdminOrderListItem) => OrderStatus;
  onAdvance: (order: AdminOrderListItem, nextStatus: OrderStatus) => void;
  onCancel: (order: AdminOrderListItem) => void;
  onOpenOrder: (orderId: string) => void;
  busyOrderId: string | null;
  hideDelivered: boolean;
};

/**
 * Versão compacta do quadro para o celular: escolhe a raia, depois a coluna,
 * e mostra os cards em lista. Sem arraste — tocar no card abre o modal de
 * detalhes; o avanço é pelo botão.
 */
export default function AdminKanbanMobile({
  orders,
  displayStatusFor,
  onAdvance,
  onCancel,
  onOpenOrder,
  busyOrderId,
  hideDelivered,
}: Props) {
  // Raia e coluna ficam salvas por aparelho — um refresh (ou reabrir o PWA)
  // mantém o operador onde ele estava, em vez de voltar para "Retirada".
  const [lanePref, setLanePref] = useUiPref('pedidos-mobile:lane', 'pickup');
  const [colPref, setColPref] = useUiPref('pedidos-mobile:col', '');
  const lane: LaneKey = lanePref === 'delivery' ? 'delivery' : 'pickup';
  const status = (colPref || null) as BoardColumn | null;

  const laneOrders = useMemo(
    () => orders.filter((order) => laneOf(order) === lane),
    [orders, lane],
  );

  const columns = columnsForLane(lane, hideDelivered);
  const activeStatus =
    status && columns.includes(status) ? status : (columns[0] ?? null);

  const countFor = (target: BoardColumn) =>
    laneOrders.filter(
      (order) => columnOf(order, displayStatusFor(order)) === target,
    ).length;

  const visible = activeStatus
    ? laneOrders.filter(
        (order) => columnOf(order, displayStatusFor(order)) === activeStatus,
      )
    : [];

  return (
    <div className="space-y-2.5 px-3 pb-7 pt-16 lg:hidden">
      <div className="flex rounded-md bg-muted p-0.5">
        {LANES.map((item) => {
          const total = orders.filter(
            (order) => laneOf(order) === item.key,
          ).length;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setLanePref(item.key)}
              className={cn(
                'flex-1 rounded-sm py-1.5 text-center text-xs font-medium transition-colors',
                lane === item.key
                  ? 'bg-card font-semibold text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {item.label}
              {total > 0 ? (
                <span className="ml-1 tabular-nums text-muted-foreground">
                  {total}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {columns.map((columnStatus) => (
          <button
            key={columnStatus}
            type="button"
            onClick={() => setColPref(columnStatus)}
            className={cn(
              'shrink-0 rounded-md border px-3 py-1.5 text-2xs font-semibold transition-colors',
              activeStatus === columnStatus
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-card',
            )}
          >
            {columnShortLabel(columnStatus)} ({countFor(columnStatus)})
          </button>
        ))}
      </div>

      {visible.length > 0 ? (
        <div className="space-y-2.5">
          {visible.map((order) => (
            <div
              key={order.id}
              role="button"
              tabIndex={0}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('button')) return;
                onOpenOrder(order.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpenOrder(order.id);
                }
              }}
              className="cursor-pointer"
            >
              <AdminOrderCardBody
                order={order}
                displayStatus={displayStatusFor(order)}
                onAdvance={onAdvance}
                onCancel={onCancel}
                busy={busyOrderId === order.id}
                roomy
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 pt-[70px]">
          <Inbox className="size-[34px] text-muted-foreground" />
          <p className="text-sm font-semibold">Nenhum pedido nessa coluna</p>
        </div>
      )}
    </div>
  );
}
