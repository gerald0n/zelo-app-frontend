'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Loader2 } from 'lucide-react';
import AdminOrderCard from '@/components/admin/AdminOrderCard';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { apiJson } from '@/lib/api';
import { adminContainerClass } from '@/lib/layout';
import { cn } from '@/lib/cn';
import { adminKeys } from '@/lib/query-keys';
import type { AdminOrderListItem } from '@/modules/admin/types';
import {
  buildDashboard,
  PERIOD_LABEL,
  type DashboardPeriod,
} from '@/app/_components/dashboard-metrics';
import { DashboardStats } from '@/app/_components/DashboardStats';
import { SalesChart } from '@/app/_components/SalesChart';
import { TopProducts } from '@/app/_components/TopProducts';
import { OperationsView } from '@/app/_components/OperationsView';
import { FinancialView } from '@/app/_components/FinancialView';

const PERIODS: DashboardPeriod[] = ['today', '7d', '30d'];

export default function AdminDashboardPage() {
  const { isAuthenticated, ready } = useRequireAdmin();
  const [period, setPeriod] = useState<DashboardPeriod>('today');

  const ordersQuery = useQuery({
    // Realtime invalida esta query pelo `AdminRealtimeProvider` — não entra
    // no queryKey (senão troca a identidade e pisca o spinner a cada evento).
    queryKey: adminKeys.orders('all'),
    enabled: ready && isAuthenticated,
    queryFn: () =>
      apiJson<{ orders: AdminOrderListItem[] }>(
        '/api/v1/admin/orders?scope=all',
      ),
  });

  const orders = useMemo(
    () => ordersQuery.data?.orders ?? [],
    [ordersQuery.data],
  );
  const data = useMemo(() => buildDashboard(orders, period), [orders, period]);
  const active = useMemo(
    () =>
      orders.filter(
        (order) => !['delivered', 'cancelled'].includes(order.status),
      ),
    [orders],
  );

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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-bold uppercase tracking-widest text-primary">
            Gestão operacional e desempenho
          </p>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">
            Visão geral do ateliê
          </h1>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Faturamento, volume de pedidos e velocidade de atendimento — mais
            cancelamentos, produção e financeiro — em tempo real.
          </p>
        </div>
        <div className="flex rounded-lg border border-border bg-card p-0.5">
          {PERIODS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPeriod(item)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                period === item
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {PERIOD_LABEL[item]}
            </button>
          ))}
        </div>
      </header>

      {ordersQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <DashboardStats data={data} activeCount={active.length} />

          <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
            <SalesChart buckets={data.buckets} dense={period === '30d'} />
            <TopProducts products={data.topProducts} />
          </div>

          <h2 className="font-serif text-base font-bold pt-1">Operação</h2>
          <OperationsView period={period} />

          <h2 className="font-serif text-base font-bold pt-1">Financeiro</h2>
          <FinancialView period={period} />

          <div className="flex items-center justify-between pt-1">
            <h2 className="font-serif text-base font-bold">Pedidos ativos</h2>
            <Link
              href="/pedidos"
              className="flex items-center gap-0.5 text-xs font-semibold text-primary"
            >
              Ver quadro <ChevronRight className="size-4" />
            </Link>
          </div>

          {active.length ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {active.slice(0, 6).map((order) => (
                <AdminOrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum pedido na fila.
            </p>
          )}
        </>
      )}
    </div>
  );
}
