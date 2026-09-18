import { formatCatalogPrice } from '@/modules/catalog/types';
import type { OrdersReportSummary as Summary } from '@/modules/admin/orders-report';

/** Faixa de indicadores do relatório detalhado — mesmo visual da visão geral. */
export function OrdersReportSummary({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <div className="rounded-xl border border-border bg-card p-3.5">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pedidos
        </p>
        <p className="mt-2 font-serif text-2xl font-bold">{summary.totalOrders}</p>
        <p className="mt-0.5 text-2xs text-muted-foreground">
          {summary.deliveryOrders} entrega · {summary.pickupOrders} retirada (
          {summary.deliveryPct}% delivery)
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-3.5">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          Faturamento
        </p>
        <p className="mt-2 font-serif text-2xl font-bold">
          {formatCatalogPrice(summary.revenueCents)}
        </p>
        <p className="mt-0.5 text-2xs text-muted-foreground">
          {formatCatalogPrice(summary.deliveryRevenueCents)} entrega ·{' '}
          {formatCatalogPrice(summary.pickupRevenueCents)} retirada
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-3.5">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ticket médio
        </p>
        <p className="mt-2 font-serif text-2xl font-bold">
          {formatCatalogPrice(summary.avgTicketCents)}
        </p>
        <p className="mt-0.5 text-2xs text-muted-foreground">
          {formatCatalogPrice(summary.avgTicketDeliveryCents)} entrega ·{' '}
          {formatCatalogPrice(summary.avgTicketPickupCents)} retirada
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-3.5">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          Taxas de entrega
        </p>
        <p className="mt-2 font-serif text-2xl font-bold">
          {formatCatalogPrice(summary.deliveryFeeTotalCents)}
        </p>
        <p className="mt-0.5 text-2xs text-muted-foreground">
          média {formatCatalogPrice(summary.avgDeliveryFeeCents)} ·{' '}
          {summary.freeDeliveries} grátis · {summary.paidDeliveries} com taxa
        </p>
      </div>
    </div>
  );
}
