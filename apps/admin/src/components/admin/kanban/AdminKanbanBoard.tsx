'use client';

import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Inbox } from 'lucide-react';
import type { AdminOrderListItem } from '@/modules/admin/types';
import { nextAdminStatus } from '@/modules/admin/types';
import type { OrderStatus } from '@/modules/orders/types';
import {
  LANES,
  LANE_LABEL,
  type BoardColumn,
  type LaneKey,
  boardColumnForStatus,
  columnOf,
  columnsForLane,
  isOnLiveBoard,
  laneOf,
} from '@/lib/admin/kanban-board';
import AdminOrderCardBody from '@/components/admin/kanban/AdminOrderCardBody';
import KanbanColumn from '@/components/admin/kanban/KanbanColumn';

type Props = {
  orders: AdminOrderListItem[];
  displayStatusFor: (order: AdminOrderListItem) => OrderStatus;
  onAdvance: (order: AdminOrderListItem, nextStatus: OrderStatus) => void;
  onCancel: (order: AdminOrderListItem) => void;
  onOpenOrder: (orderId: string) => void;
  busyOrderId: string | null;
  hideDelivered: boolean;
};

/** Só vira arraste depois de andar isto em pixels — abaixo disso é clique. */
const DRAG_THRESHOLD = 8;
/** Elementos que são clique de verdade e nunca iniciam um arraste. */
const INTERACTIVE = 'button, a, input, label';

const cellKey = (lane: LaneKey, column: BoardColumn) => `${lane}:${column}`;

type DragState = {
  order: AdminOrderListItem;
  lane: LaneKey;
  from: OrderStatus;
  /** Status real passado ao avançar (a etapa imediatamente seguinte). */
  target: OrderStatus;
  /** Coluna que hospeda esse status — onde o card precisa ser solto. */
  targetColumn: BoardColumn;
  width: number;
  grabX: number;
  grabY: number;
  x: number;
  y: number;
  /** `lane:column` sob o cursor agora, se houver. */
  over: string | null;
};

function laneBuckets(
  orders: AdminOrderListItem[],
  lane: LaneKey,
  displayStatusFor: Props['displayStatusFor'],
) {
  const laneOrders = orders
    .filter((order) => laneOf(order) === lane)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  const byColumn = new Map<BoardColumn, AdminOrderListItem[]>();
  for (const order of laneOrders) {
    const column = columnOf(order, displayStatusFor(order));
    const bucket = byColumn.get(column);
    if (bucket) bucket.push(order);
    else byColumn.set(column, [order]);
  }
  return { total: laneOrders.length, byColumn };
}

/**
 * Quadro de pedidos com dois boards empilhados (Retirada / Delivery), só no
 * desktop — o mobile usa `AdminKanbanMobile`. Cada board é um pipeline
 * independente cuja primeira coluna é "Agendados" (pedidos agendados ainda
 * não iniciados), destacada por uma cor própria.
 *
 * Arraste: segura em qualquer ponto do card (menos botões e links) e, passado
 * um limiar de alguns pixels, o card "levanta" e segue o cursor num overlay
 * renderizado num portal no `body` — sempre visível, sem criar scroll em
 * nenhum container. Soltar na coluna imediatamente seguinte confirma o avanço
 * (`nextAdminStatus`); qualquer outro destino volta o card ao lugar. Cards da
 * coluna "Agendados" não são arrastáveis.
 */
export default function AdminKanbanBoard({
  orders,
  displayStatusFor,
  onAdvance,
  onCancel,
  onOpenOrder,
  busyOrderId,
  hideDelivered,
}: Props) {
  const columnRefs = useRef(new Map<string, HTMLElement>());
  const suppressClickRef = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  function handleCardActivate(order: AdminOrderListItem) {
    if (suppressClickRef.current) return;
    onOpenOrder(order.id);
  }

  const boardOrders = useMemo(() => orders.filter(isOnLiveBoard), [orders]);

  const lanes = useMemo(
    () =>
      LANES.map((lane) => ({
        ...lane,
        columns: columnsForLane(lane.key, hideDelivered),
        ...laneBuckets(boardOrders, lane.key, displayStatusFor),
      })),
    [boardOrders, hideDelivered, displayStatusFor],
  );

  function columnAt(x: number, y: number): string | null {
    for (const [key, el] of columnRefs.current) {
      const rect = el.getBoundingClientRect();
      if (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      ) {
        return key;
      }
    }
    return null;
  }

  function startDrag(
    event: React.PointerEvent<HTMLDivElement>,
    order: AdminOrderListItem,
    lane: LaneKey,
    from: OrderStatus,
  ) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    const target = nextAdminStatus(from, order.deliveryMethod);
    if (target === null) return;
    const targetColumn = boardColumnForStatus(target);

    const rect = event.currentTarget.getBoundingClientRect();
    const origin = { x: event.clientX, y: event.clientY };
    const grabX = event.clientX - rect.left;
    const grabY = event.clientY - rect.top;
    let started = false;

    const move = (ev: PointerEvent) => {
      if (!started) {
        if (
          Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) <
          DRAG_THRESHOLD
        ) {
          return;
        }
        started = true;
        document.body.style.userSelect = 'none';
      }
      const over = columnAt(ev.clientX, ev.clientY);
      setDrag({
        order,
        lane,
        from,
        target,
        targetColumn,
        width: rect.width,
        grabX,
        grabY,
        x: ev.clientX,
        y: ev.clientY,
        over,
      });
    };

    const end = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      document.body.style.userSelect = '';
      if (!started) return;
      // Um arraste acabou de terminar — engole o `click` sintético que vem
      // logo depois para não abrir o modal.
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      setDrag(null);
      const over = columnAt(ev.clientX, ev.clientY);
      if (!over) return;
      const [overLane, overColumn] = over.split(':') as [LaneKey, BoardColumn];
      if (overLane === lane && overColumn === targetColumn) {
        onAdvance(order, target);
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  const isEmpty = lanes.every((lane) => lane.total === 0);

  return (
    <div className="hidden h-dvh bg-muted/30 p-3 pt-16 lg:block">
      {isEmpty ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card">
          <Inbox className="size-9 text-muted-foreground" />
          <p className="text-sm font-semibold">Nenhum pedido no quadro</p>
        </div>
      ) : (
        <div className="flex h-full flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-card p-3">
          {lanes.map((lane) => (
            <section
              key={lane.key}
              className="rounded-lg border border-border bg-muted/40"
            >
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <span className="text-xs font-bold uppercase tracking-wide text-primary">
                  {LANE_LABEL[lane.key]}
                </span>
                <span className="rounded-full bg-primary/15 px-1.5 text-2xs font-semibold text-primary tabular-nums">
                  {lane.total}
                </span>
              </div>

              <div className="flex items-stretch gap-3 overflow-x-auto p-3">
                {lane.columns.map((column) => {
                  const key = cellKey(lane.key, column);
                  const isDropTarget =
                    drag !== null &&
                    drag.lane === lane.key &&
                    drag.targetColumn === column;
                  return (
                    <KanbanColumn
                      key={column}
                      column={column}
                      orders={lane.byColumn.get(column) ?? []}
                      displayStatusFor={displayStatusFor}
                      onAdvance={onAdvance}
                      onCancel={onCancel}
                      busyOrderId={busyOrderId}
                      draggingOrderId={drag?.order.id ?? null}
                      isDropTarget={isDropTarget}
                      isHot={isDropTarget && drag.over === key}
                      onCardPointerDown={(event, order, status) =>
                        startDrag(event, order, lane.key, status)
                      }
                      onCardActivate={handleCardActivate}
                      columnRef={(el) => {
                        const map = columnRefs.current;
                        if (el) map.set(key, el);
                        else map.delete(key);
                      }}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {drag
        ? createPortal(
            <div
              style={{
                position: 'fixed',
                left: drag.x - drag.grabX,
                top: drag.y - drag.grabY,
                width: drag.width,
                pointerEvents: 'none',
                zIndex: 9999,
              }}
              className="rotate-2"
            >
              <AdminOrderCardBody
                order={drag.order}
                displayStatus={drag.from}
                onAdvance={() => {}}
                onCancel={() => {}}
                busy={false}
                dragging
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
