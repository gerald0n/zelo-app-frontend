'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Inbox, Loader2 } from 'lucide-react';
import AdminHeader from '@/components/admin/AdminHeader';
import AdminOrderCard from '@/components/admin/AdminOrderCard';
import { Input } from '@/components/ui/input';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { apiJson } from '@/lib/api';
import { cn } from '@/lib/cn';
import { adminKeys } from '@/lib/query-keys';
import type { AdminOrderListItem } from '@/modules/admin/types';
import { useAdminOrdersRealtime } from '@/modules/realtime/hooks';

type Filter = 'active' | 'scheduled' | 'done';

export default function AdminPedidosPage() {
  const { isAuthenticated, ready } = useRequireAdmin();
  const { isTablet } = useResponsiveLayout();
  const [filter, setFilter] = useState<Filter>('active');
  const [query, setQuery] = useState('');
  const { version: realtimeVersion } = useAdminOrdersRealtime(
    ready && isAuthenticated,
  );

  const ordersQuery = useQuery({
    queryKey: [...adminKeys.orders(filter, query.trim()), realtimeVersion],
    enabled: ready && isAuthenticated,
    queryFn: async () => {
      const params = new URLSearchParams({ scope: filter });
      if (query.trim()) params.set('q', query.trim());
      return apiJson<{ orders: AdminOrderListItem[] }>(
        `/api/v1/admin/orders?${params}`,
      );
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

  return (
    <div className="min-h-dvh bg-background lg:pl-52">
      <AdminHeader title="Pedidos" subtitle="Fila ao vivo" />
      <div
        className={cn(
          'space-y-2.5 p-3',
          isTablet && 'mx-auto w-full max-w-[920px] pt-5',
        )}
      >
        <div className="flex h-11 items-center gap-2 rounded-[9px] border border-border px-3">
          <Search className="size-[18px] text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Número, cliente ou produto"
            className="h-auto flex-1 border-none bg-transparent p-0 text-sm shadow-none outline-none focus-visible:ring-0"
          />
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {(['active', 'scheduled', 'done'] as Filter[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={cn(
                'shrink-0 rounded-md border px-[13px] py-1.5 text-[11px] font-semibold',
                filter === item
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-card',
              )}
            >
              {item === 'active'
                ? 'Ativos'
                : item === 'scheduled'
                  ? 'Agendados'
                  : 'Finalizados'}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          'space-y-2.5 px-3 pb-7',
          isTablet && 'mx-auto w-full max-w-[920px]',
        )}
      >
        {ordersQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length ? (
          orders.map((order) => (
            <AdminOrderCard key={order.id} order={order} />
          ))
        ) : (
          <div className="flex flex-col items-center gap-2 pt-[70px]">
            <Inbox className="size-[34px] text-muted-foreground" />
            <p className="text-sm font-semibold">Nenhum pedido encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
