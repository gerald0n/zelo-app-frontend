import { formatCatalogPrice } from '@/modules/catalog/types';
import { ReportBar } from '@/app/_components/ReportBar';
import type {
  DistanceBucket,
  HourBucket,
  OrdersReportSummary,
} from '@/modules/admin/orders-report';

type Props = {
  summary: OrdersReportSummary;
  distanceBuckets: DistanceBucket[];
  hourBuckets: HourBucket[];
};

/** Distribuição por distância e por horário de criação — barras simples, sem lib de gráfico. */
export function OrdersReportDistributions({
  summary,
  distanceBuckets,
  hourBuckets,
}: Props) {
  const hasDistance = distanceBuckets.some((b) => b.count > 0);
  const hourRows = hourBuckets.filter((b) => b.orders > 0);
  if (!hasDistance && hourRows.length === 0) return null;

  const maxDistanceBucket = Math.max(1, ...distanceBuckets.map((b) => b.count));
  const maxHourBucket = Math.max(1, ...hourRows.map((b) => b.orders));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {hasDistance ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-serif text-base font-bold">
            Distribuição por distância
          </h2>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            Distância média:{' '}
            {summary.avgDistanceMeters !== null
              ? `${(summary.avgDistanceMeters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
              : '—'}
          </p>
          <div className="pt-2">
            {distanceBuckets.map((bucket) => (
              <ReportBar
                key={bucket.label}
                label={`${bucket.label} — ${formatCatalogPrice(bucket.avgTicketCents)} médio`}
                value={bucket.count}
                max={maxDistanceBucket}
              />
            ))}
          </div>
        </div>
      ) : null}

      {hourRows.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-serif text-base font-bold">
            Concentração por horário
          </h2>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            Horário de criação do pedido (não o agendado)
          </p>
          <div className="pt-2">
            {hourRows.map((bucket) => (
              <ReportBar
                key={bucket.hour}
                label={`${bucket.label} — ${bucket.deliveries} entrega · ${bucket.pickups} retirada`}
                value={bucket.orders}
                max={maxHourBucket}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
