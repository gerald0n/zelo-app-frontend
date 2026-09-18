import type { DashboardData } from '@/modules/admin/dashboard';
import type { OperationsReport } from '@/modules/admin/reports';
import type { FinancialReport } from '@/modules/admin/financial-report';

const METHOD_LABEL: Record<string, string> = {
  pix: 'Pix',
  cash: 'Dinheiro',
  card: 'Cartão',
  pix_manual: 'Pix (manual)',
};

function toReais(cents: number): number {
  return Math.round(cents) / 100;
}

function toKm(meters: number): number {
  return Math.round(meters / 100) / 10;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

export type DashboardExportInput = {
  periodLabel: string;
  /** Range `[from, to)` usado no filtro; `to` é exclusivo. */
  range: { from: string; to: string };
  dashboard: DashboardData;
  activeCount: number;
  operations: OperationsReport;
  financial: FinancialReport;
};

/** Gera o relatório .xlsx da visão geral (período filtrado) e dispara o download. */
export async function exportDashboardXlsx({
  periodLabel,
  range,
  dashboard,
  activeCount,
  operations,
  financial,
}: DashboardExportInput): Promise<void> {
  const XLSX = await import('xlsx');

  const wb = XLSX.utils.book_new();
  const inclusiveTo = new Date(Date.parse(range.to) - 1).toISOString();

  const overviewSheet = XLSX.utils.aoa_to_sheet([
    ['Relatório', 'Visão geral do ateliê'],
    ['Período', periodLabel],
    ['De', formatDate(range.from)],
    ['Até', formatDate(inclusiveTo)],
    [],
    ['Indicador', 'Valor'],
    ['Faturamento (R$)', toReais(dashboard.revenueCents)],
    ['Variação vs. período anterior (%)', dashboard.deltaPct ?? ''],
    ['Pedidos', dashboard.orderCount],
    ['Concluídos', dashboard.deliveredCount],
    ['Em aberto agora', activeCount],
    ['Ticket médio (R$)', toReais(dashboard.ticketCents)],
    ['Pedidos balcão', dashboard.pickupCount],
    ['Faturamento balcão (R$)', toReais(dashboard.pickupCents)],
    ['Pedidos entrega', dashboard.deliveryCount],
    ['Faturamento entrega (R$)', toReais(dashboard.deliveryCents)],
    [
      'Distância média das entregas (km)',
      dashboard.avgDistanceMeters !== null
        ? toKm(dashboard.avgDistanceMeters)
        : '',
    ],
  ]);
  XLSX.utils.book_append_sheet(wb, overviewSheet, 'Visão geral');

  const salesSheet = XLSX.utils.aoa_to_sheet([
    ['Período', 'Faturamento (R$)', 'Pedidos'],
    ...dashboard.buckets.map((b) => [b.label, toReais(b.cents), b.count]),
  ]);
  XLSX.utils.book_append_sheet(wb, salesSheet, 'Curva de vendas');

  const topProductsSheet = XLSX.utils.aoa_to_sheet([
    ['Produto', 'Quantidade'],
    ...dashboard.topProducts.map((p) => [p.name, p.quantity]),
  ]);
  XLSX.utils.book_append_sheet(wb, topProductsSheet, 'Mais vendidos');

  const cancellationsSheet = XLSX.utils.aoa_to_sheet([
    ['Total de cancelamentos', operations.cancellations.total],
    ['Valor não faturado (R$)', toReais(operations.cancellations.valueCents)],
    [],
    ['Motivo', 'Quantidade'],
    ...operations.cancellations.byReason.map((r) => [r.reason, r.count]),
    [],
    ['Pedido', 'Motivo', 'Valor (R$)', 'Cancelado em'],
    ...operations.cancellations.recent.map((o) => [
      `#${o.orderNumber}`,
      o.reason,
      toReais(o.totalCents),
      formatDateTime(o.cancelledAt),
    ]),
  ]);
  XLSX.utils.book_append_sheet(wb, cancellationsSheet, 'Cancelamentos');

  const productionSheet = XLSX.utils.aoa_to_sheet([
    ['Total de itens', operations.production.totalItems],
    [],
    ['Produto', 'Quantidade'],
    ...operations.production.items.map((p) => [p.name, p.quantity]),
  ]);
  XLSX.utils.book_append_sheet(wb, productionSheet, 'Produção');

  const byMethodRows = (
    Object.entries(financial.byMethod) as Array<
      [string, (typeof financial.byMethod)[keyof typeof financial.byMethod]]
    >
  ).map(([method, m]) => [
    METHOD_LABEL[method] ?? method,
    toReais(m.grossCents),
    toReais(m.feeCents),
    m.count,
  ]);
  const financialSheet = XLSX.utils.aoa_to_sheet([
    ['Faturamento bruto (R$)', toReais(financial.gross.totalCents)],
    ['Pedidos', financial.gross.orderCount],
    ['Taxas totais (R$)', toReais(financial.fees.totalCents)],
    ['Taxas reais (R$)', toReais(financial.fees.realCents)],
    ['Taxas estimadas (R$)', toReais(financial.fees.estimatedCents)],
    ['Líquido (R$)', toReais(financial.netCents)],
    ['Estornos', financial.refunds.count],
    ['Valor estornado (R$)', toReais(financial.refunds.valueCents)],
    [],
    ['Método', 'Bruto (R$)', 'Taxa (R$)', 'Pedidos'],
    ...byMethodRows,
  ]);
  XLSX.utils.book_append_sheet(wb, financialSheet, 'Financeiro');

  if (financial.pixTransactions.length > 0) {
    const pixSheet = XLSX.utils.aoa_to_sheet([
      ['Pedido', 'Data', 'Bruto (R$)', 'Taxa (R$)', 'Líquido (R$)', 'Taxa estimada'],
      ...financial.pixTransactions.map((t) => [
        `#${t.orderNumber}`,
        formatDateTime(t.createdAt),
        toReais(t.grossCents),
        toReais(t.feeCents),
        toReais(t.netCents),
        t.estimated ? 'Sim' : 'Não',
      ]),
    ]);
    XLSX.utils.book_append_sheet(wb, pixSheet, 'Pix');
  }

  const fileName = `visao-geral_${range.from.slice(0, 10)}_a_${inclusiveTo.slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
