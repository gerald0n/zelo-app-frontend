'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Receipt,
  Flame,
  Wallet,
  Store,
  Pause,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import AdminHeader from '@/components/admin/AdminHeader';
import AdminOrderCard from '@/components/admin/AdminOrderCard';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { apiJson } from '@/lib/api';
import { cn } from '@/lib/cn';
import { adminKeys } from '@/lib/query-keys';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type { AdminOrderListItem } from '@/modules/admin/types';
import { useAdminOrdersRealtime } from '@/modules/realtime/hooks';

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const { isAuthenticated, ready } = useRequireAdmin();
  const { isTablet } = useResponsiveLayout();
  const { version: realtimeVersion } = useAdminOrdersRealtime(
    ready && isAuthenticated,
  );

  const ordersQuery = useQuery({
    queryKey: [...adminKeys.orders('all'), realtimeVersion],
    enabled: ready && isAuthenticated,
    queryFn: () =>
      apiJson<{ orders: AdminOrderListItem[] }>(
        '/api/v1/admin/orders?scope=all',
      ),
  });

  const storeQuery = useQuery({
    queryKey: adminKeys.store(),
    enabled: ready && isAuthenticated,
    queryFn: () =>
      apiJson<{ acceptingOrders: boolean }>('/api/v1/admin/store'),
  });

  const toggleMutation = useMutation({
    mutationFn: (acceptingOrders: boolean) =>
      apiJson('/api/v1/admin/store', {
        method: 'PATCH',
        body: JSON.stringify({ acceptingOrders }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.store() });
    },
  });

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background lg:pl-52">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const orders = ordersQuery.data?.orders ?? [];
  const acceptingOrders = storeQuery.data?.acceptingOrders ?? true;
  const active = orders.filter(
    (order) => !['delivered', 'cancelled'].includes(order.status),
  );
  const production = orders.filter(
    (order) => order.status === 'in_production',
  ).length;
  const revenue = orders
    .filter((order) => order.status !== 'cancelled')
    .reduce((sum, order) => sum + order.totalCents, 0);

  const metrics = [
    { label: 'Na fila', value: String(active.length), icon: Receipt },
    { label: 'Em produção', value: String(production), icon: Flame },
    {
      label: 'Vendas',
      value: formatCatalogPrice(revenue),
      icon: Wallet,
    },
  ];

  return (
    <div className="min-h-dvh bg-background lg:pl-52">
      <AdminHeader title="Visão geral" subtitle="Operação ao vivo" />
      <div
        className={cn(
          'space-y-[18px] p-3.5 pb-8',
          isTablet && 'mx-auto w-full max-w-[1100px] p-4',
        )}
      >
        <button
          type="button"
          onClick={() => toggleMutation.mutate(!acceptingOrders)}
          className={cn(
            'flex w-full items-center gap-[11px] rounded-lg border p-[13px] text-left',
            acceptingOrders
              ? 'border-success/40 bg-success/10'
              : 'border-destructive/40 bg-destructive/10',
          )}
        >
          <span
            className={cn(
              'flex size-9 items-center justify-center rounded-lg',
              acceptingOrders ? 'bg-success' : 'bg-destructive',
            )}
          >
            {acceptingOrders ? (
              <Store className="size-[18px] text-success-foreground" />
            ) : (
              <Pause className="size-[18px] text-primary-foreground" />
            )}
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {acceptingOrders ? 'Loja recebendo pedidos' : 'Loja pausada'}
            </p>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              Toque para {acceptingOrders ? 'pausar' : 'retomar'} a operação
            </p>
          </div>
        </button>

        <div className="grid grid-cols-3 gap-2">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-border bg-card p-3"
            >
              <metric.icon className="size-4 text-primary" />
              <p className="mt-2 text-lg font-bold">{metric.value}</p>
              <p className="text-2xs text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Pedidos ativos</h2>
          <Link
            href="/admin/pedidos"
            className="flex items-center gap-0.5 text-xs font-semibold text-primary"
          >
            Ver todos <ChevronRight className="size-4" />
          </Link>
        </div>

        {ordersQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : active.length ? (
          active.slice(0, 5).map((order) => (
            <AdminOrderCard key={order.id} order={order} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum pedido na fila.</p>
        )}
      </div>
    </div>
  );
}
