'use client';

import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { ApiError, apiJson } from '@/lib/api';
import { adminContainerClass } from '@/lib/layout';
import { cn } from '@/lib/cn';
import { adminKeys } from '@/lib/query-keys';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { PERIOD_LABEL, resolvePeriodRange } from '@/modules/admin/dashboard';
import { aggregateOrdersReport, type OrderReportRow } from '@/modules/admin/orders-report';
import { exportOrdersReportXlsx } from '@/modules/admin/orders-report-export';
import AdminOrderDetailModal from '@/components/admin/kanban/AdminOrderDetailModal';
import {
  OrdersReportFilters,
  defaultOrdersReportFilters,
  describeFilters,
  type OrdersReportFiltersValue,
} from './_components/OrdersReportFilters';
import { OrdersReportSummary } from './_components/OrdersReportSummary';
import { OrdersReportDistributions } from './_components/OrdersReportDistributions';
import { OrdersReportTable } from './_components/OrdersReportTable';

const PAGE_SIZE = 30;

export default function AdminOrdersReportPage() {
  const { isAuthenticated, ready } = useRequireAdmin();
  const { alert } = useAppDialog();

  const [filters, setFilters] = useState<OrdersReportFiltersValue>(
    defaultOrdersReportFilters,
  );
  const [page, setPage] = useState(1);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const range = useMemo(
    () =>
      resolvePeriodRange(
        filters.period,
        filters.period === 'custom' ? filters.customRange : null,
      ),
    [filters.period, filters.customRange],
  );

  const filtersKey = [
    range.from,
    range.to,
    filters.deliveryMethod,
    filters.status,
    filters.paymentMethod,
    filters.hasDiscount,
    filters.minDistanceKm,
    filters.maxDistanceKm,
  ].join('|');

  // Reseta a página ao trocar de filtro — ajuste durante a renderização em
  // vez de um efeito, pra não disparar um render extra desnecessário.
  const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
  if (filtersKey !== prevFiltersKey) {
    setPrevFiltersKey(filtersKey);
    setPage(1);
  }

  const reportQuery = useQuery({
    queryKey: adminKeys.ordersReport(filtersKey),
    enabled: ready && isAuthenticated,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const params = new URLSearchParams({ from: range.from, to: range.to });
      if (filters.deliveryMethod !== 'all') {
        params.set('deliveryMethod', filters.deliveryMethod);
      }
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.paymentMethod !== 'all') {
        params.set('paymentMethod', filters.paymentMethod);
      }
      if (filters.hasDiscount !== 'all') {
        params.set('hasDiscount', filters.hasDiscount === 'yes' ? 'true' : 'false');
      }
      if (filters.minDistanceKm) params.set('minDistanceKm', filters.minDistanceKm);
      if (filters.maxDistanceKm) params.set('maxDistanceKm', filters.maxDistanceKm);
      return apiJson<{ orders: OrderReportRow[]; total: number; truncated: boolean }>(
        `/api/v1/admin/orders/report?${params}`,
      );
    },
  });

  const orders = useMemo(
    () => reportQuery.data?.orders ?? [],
    [reportQuery.data],
  );
  const truncated = reportQuery.data?.truncated ?? false;
  const aggregate = useMemo(() => aggregateOrdersReport(orders), [orders]);
  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const pageOrders = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = async () => {
    if (!reportQuery.data) return;
    setExporting(true);
    try {
      await exportOrdersReportXlsx({
        periodLabel: PERIOD_LABEL[filters.period],
        filtersLabel: describeFilters(filters),
        range,
        rows: orders,
        summary: aggregate.summary,
        distanceBuckets: aggregate.distanceBuckets,
        hourBuckets: aggregate.hourBuckets,
      });
    } catch (error) {
      await alert({
        title: 'Não foi possível exportar o relatório',
        description:
          error instanceof ApiError ? error.message : 'Tente novamente em instantes.',
      });
    } finally {
      setExporting(false);
    }
  };

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'min-h-dvh space-y-4 p-3.5 pb-24 md:px-6 md:pt-6',
        adminContainerClass,
      )}
    >
      <OrdersReportFilters
        value={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onExport={handleExport}
        exportDisabled={!reportQuery.data}
        exporting={exporting}
      />

      {truncated ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          O período selecionado tem mais pedidos do que o relatório consegue
          trazer de uma vez — refine o período ou os filtros pra ver o
          conjunto completo.
        </p>
      ) : null}

      {reportQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : reportQuery.isError ? (
        <p className="py-16 text-center text-sm text-destructive">
          Não foi possível carregar o relatório.
        </p>
      ) : orders.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nenhum pedido encontrado com esses filtros.
        </p>
      ) : (
        <>
          <OrdersReportSummary summary={aggregate.summary} />
          <OrdersReportDistributions
            summary={aggregate.summary}
            distanceBuckets={aggregate.distanceBuckets}
            hourBuckets={aggregate.hourBuckets}
          />
          <OrdersReportTable
            orders={orders}
            pageOrders={pageOrders}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onSelectOrder={setDetailOrderId}
          />
        </>
      )}

      <AdminOrderDetailModal
        orderId={detailOrderId}
        onClose={() => setDetailOrderId(null)}
      />
    </div>
  );
}
