import { statusLabel } from '@/modules/orders/types';
import { paymentMethodLabel } from '@/lib/admin/payment-method-label';
import type {
  DistanceBucket,
  HourBucket,
  OrderReportRow,
  OrdersReportSummary,
} from '@/modules/admin/orders-report';

const CURRENCY_FMT = '"R$" #,##0.00';
const KM_FMT = '0.0" km"';
const PCT_FMT = '0.0"%"';
const DATE_FMT = 'dd/mm/yyyy';
const TIME_FMT = 'hh:mm';
const DATETIME_FMT = 'dd/mm/yyyy hh:mm';

function toReais(cents: number): number {
  return Math.round(cents) / 100;
}

export type OrdersReportExportInput = {
  periodLabel: string;
  filtersLabel: string;
  range: { from: string; to: string };
  rows: OrderReportRow[];
  summary: OrdersReportSummary;
  distanceBuckets: DistanceBucket[];
  hourBuckets: HourBucket[];
};

/** Gera o relatório detalhado de pedidos (.xlsx) e dispara o download. */
export async function exportOrdersReportXlsx({
  periodLabel,
  filtersLabel,
  range,
  rows,
  summary,
  distanceBuckets,
  hourBuckets,
}: OrdersReportExportInput): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const inclusiveTo = new Date(Date.parse(range.to) - 1);

  const summarySheet = wb.addWorksheet('Resumo');
  summarySheet.getColumn(1).width = 32;
  summarySheet.getColumn(2).width = 22;

  const addIndicatorRow = (
    label: string,
    value: string | number | Date,
    numFmt?: string,
  ) => {
    const row = summarySheet.addRow([label, value]);
    if (numFmt) row.getCell(2).numFmt = numFmt;
  };

  addIndicatorRow('Relatório', 'Relatório detalhado de pedidos');
  addIndicatorRow('Período', periodLabel);
  addIndicatorRow('De', new Date(range.from), DATE_FMT);
  addIndicatorRow('Até', inclusiveTo, DATE_FMT);
  addIndicatorRow('Filtros', filtersLabel);
  summarySheet.addRow([]);
  summarySheet.addRow(['Indicador', 'Valor']);
  addIndicatorRow('Total de pedidos', summary.totalOrders);
  addIndicatorRow('Pedidos de entrega', summary.deliveryOrders);
  addIndicatorRow('Pedidos de retirada', summary.pickupOrders);
  addIndicatorRow('% delivery', summary.deliveryPct, PCT_FMT);
  addIndicatorRow('Faturamento total (R$)', toReais(summary.revenueCents), CURRENCY_FMT);
  addIndicatorRow(
    'Faturamento delivery (R$)',
    toReais(summary.deliveryRevenueCents),
    CURRENCY_FMT,
  );
  addIndicatorRow(
    'Faturamento retirada (R$)',
    toReais(summary.pickupRevenueCents),
    CURRENCY_FMT,
  );
  addIndicatorRow('Ticket médio geral (R$)', toReais(summary.avgTicketCents), CURRENCY_FMT);
  addIndicatorRow(
    'Ticket médio delivery (R$)',
    toReais(summary.avgTicketDeliveryCents),
    CURRENCY_FMT,
  );
  addIndicatorRow(
    'Ticket médio retirada (R$)',
    toReais(summary.avgTicketPickupCents),
    CURRENCY_FMT,
  );
  addIndicatorRow(
    'Total em taxas de entrega (R$)',
    toReais(summary.deliveryFeeTotalCents),
    CURRENCY_FMT,
  );
  addIndicatorRow(
    'Taxa média por entrega (R$)',
    toReais(summary.avgDeliveryFeeCents),
    CURRENCY_FMT,
  );
  addIndicatorRow(
    'Distância média das entregas (km)',
    summary.avgDistanceMeters !== null ? summary.avgDistanceMeters / 1000 : '',
    summary.avgDistanceMeters !== null ? KM_FMT : undefined,
  );
  addIndicatorRow('Entregas gratuitas', summary.freeDeliveries);
  addIndicatorRow('Entregas com taxa', summary.paidDeliveries);

  if (distanceBuckets.some((b) => b.count > 0)) {
    summarySheet.addRow([]);
    summarySheet.addRow([
      'Distribuição por distância',
      'Entregas',
      '%',
      'Ticket médio (R$)',
      'Taxa média (R$)',
      'Faturamento (R$)',
    ]);
    for (const bucket of distanceBuckets) {
      const row = summarySheet.addRow([
        bucket.label,
        bucket.count,
        bucket.pct,
        toReais(bucket.avgTicketCents),
        toReais(bucket.avgDeliveryFeeCents),
        toReais(bucket.revenueCents),
      ]);
      row.getCell(3).numFmt = PCT_FMT;
      row.getCell(4).numFmt = CURRENCY_FMT;
      row.getCell(5).numFmt = CURRENCY_FMT;
      row.getCell(6).numFmt = CURRENCY_FMT;
    }
  }

  const hourRows = hourBuckets.filter((b) => b.orders > 0);
  if (hourRows.length > 0) {
    summarySheet.addRow([]);
    summarySheet.addRow([
      'Distribuição por horário de criação',
      'Pedidos',
      'Entregas',
      'Retiradas',
      'Faturamento (R$)',
    ]);
    for (const bucket of hourRows) {
      const row = summarySheet.addRow([
        bucket.label,
        bucket.orders,
        bucket.deliveries,
        bucket.pickups,
        toReais(bucket.revenueCents),
      ]);
      row.getCell(5).numFmt = CURRENCY_FMT;
    }
  }

  const ordersSheet = wb.addWorksheet('Pedidos');
  ordersSheet.columns = [
    { header: 'Pedido', key: 'orderNumber', width: 10 },
    { header: 'Data', key: 'date', width: 12, style: { numFmt: DATE_FMT } },
    { header: 'Hora', key: 'time', width: 8, style: { numFmt: TIME_FMT } },
    { header: 'Tipo', key: 'type', width: 10 },
    {
      header: 'Valor bruto dos produtos (R$)',
      key: 'grossProducts',
      width: 16,
      style: { numFmt: CURRENCY_FMT },
    },
    { header: 'Desconto (R$)', key: 'discount', width: 12, style: { numFmt: CURRENCY_FMT } },
    {
      header: 'Taxa de entrega (R$)',
      key: 'deliveryFee',
      width: 14,
      style: { numFmt: CURRENCY_FMT },
    },
    { header: 'Valor total (R$)', key: 'total', width: 12, style: { numFmt: CURRENCY_FMT } },
    { header: 'Forma de pagamento', key: 'paymentMethod', width: 16 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Distância (km)', key: 'distance', width: 12, style: { numFmt: KM_FMT } },
    { header: 'Bairro', key: 'neighborhood', width: 18 },
    {
      header: 'Horário agendado',
      key: 'scheduledFor',
      width: 16,
      style: { numFmt: DATETIME_FMT },
    },
    {
      header: 'Criado em',
      key: 'createdAt',
      width: 16,
      style: { numFmt: DATETIME_FMT },
    },
  ];
  ordersSheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    const createdAt = new Date(row.createdAt);
    ordersSheet.addRow({
      orderNumber: row.orderNumber,
      date: createdAt,
      time: createdAt,
      type: row.deliveryMethod === 'delivery' ? 'Entrega' : 'Retirada',
      grossProducts: toReais(row.subtotalCents + row.addOnsCents),
      discount: toReais(row.discountCents),
      deliveryFee: toReais(row.deliveryFeeCents),
      total: toReais(row.totalCents),
      paymentMethod: paymentMethodLabel(row.paymentMethod),
      status: statusLabel(row.status),
      distance: row.distanceMeters !== null ? row.distanceMeters / 1000 : null,
      neighborhood: row.neighborhood ?? null,
      scheduledFor: row.scheduledFor ? new Date(row.scheduledFor) : null,
      createdAt,
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio-pedidos_${range.from.slice(0, 10)}_a_${inclusiveTo.toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
