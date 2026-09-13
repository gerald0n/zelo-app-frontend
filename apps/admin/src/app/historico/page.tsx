'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { adminContainerClass } from '@/lib/layout';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { formatCatalogPrice } from '@/modules/catalog/types';
import { statusLabel, STATUS_COLORS } from '@/modules/orders/types';
import type { AdminOrderListItem } from '@/modules/admin/types';
import AdminOrderDetailModal from '@/components/admin/kanban/AdminOrderDetailModal';

type HistoryResponse = {
  orders: AdminOrderListItem[];
  total: number;
  page: number;
  pageSize: number;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminHistoricoPage() {
  const { ready, isAuthenticated } = useRequireAdmin();
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

  const hasFilters = Boolean(q.trim() || from || to);

  const clearFilters = () => {
    setQ('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  const historyQuery = useQuery({
    queryKey: adminKeys.orderHistory({ q: q.trim(), from, to, page }),
    enabled: ready && isAuthenticated,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (q.trim()) params.set('q', q.trim());
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return apiJson<HistoryResponse>(
        `/api/v1/admin/orders/history?${params}`,
      );
    },
  });

  const orders = historyQuery.data?.orders ?? [];
  const total = historyQuery.data?.total ?? 0;
  const pageSize = historyQuery.data?.pageSize ?? 30;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
      <header>
        <p className="text-2xs font-bold uppercase tracking-widest text-primary">
          Pedidos
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">
          Histórico
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Todos os pedidos já feitos — o quadro ao vivo só mostra os entregues
          do dia. Busque por cliente, número do pedido ou produto.
        </p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Cliente, número ou produto"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="w-[9.5rem]"
            aria-label="De"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="w-[9.5rem]"
            aria-label="Até"
          />
        </div>
        {hasFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent"
          >
            <X className="size-3.5" />
            Limpar
          </button>
        ) : null}
      </div>

      {historyQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : historyQuery.isError ? (
        <p className="py-16 text-center text-sm text-destructive">
          Não foi possível carregar o histórico.
        </p>
      ) : orders.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nenhum pedido encontrado com esses filtros.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-2xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-3.5 py-2.5">Pedido</th>
                <th className="px-3.5 py-2.5">Cliente</th>
                <th className="px-3.5 py-2.5">Itens</th>
                <th className="px-3.5 py-2.5">Total</th>
                <th className="px-3.5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailOrderId(order.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setDetailOrderId(order.id);
                    }
                  }}
                  className="cursor-pointer border-b border-border last:border-b-0 hover:bg-accent/50"
                >
                  <td className="px-3.5 py-2.5">
                    <p className="font-semibold">{order.number}</p>
                    <p className="text-2xs text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </p>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <p className="max-w-[12rem] truncate">
                      {order.customerName ?? 'Cliente'}
                    </p>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <p className="max-w-[16rem] truncate text-muted-foreground">
                      {order.items
                        .map((item) => `${item.quantity}× ${item.name}`)
                        .join(', ')}
                    </p>
                  </td>
                  <td className="px-3.5 py-2.5 font-semibold">
                    {formatCatalogPrice(order.totalCents)}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            {total} {total === 1 ? 'pedido encontrado' : 'pedidos encontrados'}
          </p>
          {totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-semibold transition-colors hover:bg-accent disabled:opacity-40"
              >
                Próxima
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <AdminOrderDetailModal
        orderId={detailOrderId}
        onClose={() => setDetailOrderId(null)}
      />
    </div>
  );
}
