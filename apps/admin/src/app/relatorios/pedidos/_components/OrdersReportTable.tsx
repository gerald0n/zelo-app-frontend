import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatCatalogPrice } from '@/modules/catalog/types';
import { statusLabel, STATUS_COLORS } from '@/modules/orders/types';
import { paymentMethodLabel } from '@/lib/admin/payment-method-label';
import type { OrderReportRow } from '@/modules/admin/orders-report';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDistanceKm(meters: number): string {
  return `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

type Props = {
  orders: OrderReportRow[];
  pageOrders: OrderReportRow[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSelectOrder: (orderId: string) => void;
};

export function OrdersReportTable({
  orders,
  pageOrders,
  page,
  totalPages,
  onPageChange,
  onSelectOrder,
}: Props) {
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-2xs font-bold uppercase tracking-wide text-muted-foreground">
              <th className="px-3.5 py-2.5">Pedido</th>
              <th className="px-3.5 py-2.5">Tipo</th>
              <th className="px-3.5 py-2.5">Produtos</th>
              <th className="px-3.5 py-2.5">Desconto</th>
              <th className="px-3.5 py-2.5">Taxa entrega</th>
              <th className="px-3.5 py-2.5">Total</th>
              <th className="px-3.5 py-2.5">Pagamento</th>
              <th className="px-3.5 py-2.5">Status</th>
              <th className="px-3.5 py-2.5">Distância</th>
              <th className="px-3.5 py-2.5">Bairro</th>
            </tr>
          </thead>
          <tbody>
            {pageOrders.map((order) => (
              <tr
                key={order.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectOrder(order.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectOrder(order.id);
                  }
                }}
                className="cursor-pointer border-b border-border last:border-b-0 hover:bg-accent/50"
              >
                <td className="px-3.5 py-2.5">
                  <p className="font-semibold">#{order.orderNumber}</p>
                  <p className="text-2xs text-muted-foreground">
                    {formatDate(order.createdAt)} {formatTime(order.createdAt)}
                  </p>
                </td>
                <td className="px-3.5 py-2.5">
                  {order.deliveryMethod === 'delivery' ? 'Entrega' : 'Retirada'}
                </td>
                <td className="px-3.5 py-2.5">
                  {formatCatalogPrice(order.subtotalCents + order.addOnsCents)}
                </td>
                <td className="px-3.5 py-2.5 text-muted-foreground">
                  {order.discountCents > 0
                    ? formatCatalogPrice(order.discountCents)
                    : '—'}
                </td>
                <td className="px-3.5 py-2.5 text-muted-foreground">
                  {order.deliveryMethod === 'delivery'
                    ? formatCatalogPrice(order.deliveryFeeCents)
                    : '—'}
                </td>
                <td className="px-3.5 py-2.5 font-semibold">
                  {formatCatalogPrice(order.totalCents)}
                </td>
                <td className="px-3.5 py-2.5">
                  {paymentMethodLabel(order.paymentMethod)}
                </td>
                <td className="px-3.5 py-2.5">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-2xs font-semibold',
                      STATUS_COLORS[order.status],
                    )}
                  >
                    {statusLabel(order.status)}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-muted-foreground">
                  {order.distanceMeters !== null
                    ? formatDistanceKm(order.distanceMeters)
                    : '—'}
                </td>
                <td className="px-3.5 py-2.5 text-muted-foreground">
                  <p className="max-w-[10rem] truncate">
                    {order.neighborhood ?? '—'}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>
          {orders.length}{' '}
          {orders.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'}
        </p>
        {totalPages > 1 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(Math.max(1, page - 1))}
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-semibold transition-colors hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-semibold transition-colors hover:bg-accent disabled:opacity-40"
            >
              Próxima
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
