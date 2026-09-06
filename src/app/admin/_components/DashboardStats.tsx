import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { formatCatalogPrice } from '@/modules/catalog/types';
import { cn } from '@/lib/cn';
import type { DashboardData } from '@/app/admin/_components/dashboard-metrics';

type Props = { data: DashboardData; activeCount: number };

/** Faixa de indicadores da visão geral. */
export function DashboardStats({ data, activeCount }: Props) {
  const delta = data.deltaPct;

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <div className="rounded-xl border border-border bg-card p-3.5">
        <div className="flex items-start justify-between">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Faturamento
          </p>
          <TrendingUp className="size-4 text-primary" />
        </div>
        <p className="mt-2 font-serif text-2xl font-bold">
          {formatCatalogPrice(data.revenueCents)}
        </p>
        {delta !== null ? (
          <p
            className={cn(
              'mt-0.5 flex items-center gap-1 text-2xs font-semibold',
              delta >= 0 ? 'text-success' : 'text-destructive',
            )}
          >
            {delta >= 0 ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {delta >= 0 ? '+' : ''}
            {delta}% vs período anterior
          </p>
        ) : (
          <p className="mt-0.5 text-2xs text-muted-foreground">
            Sem base de comparação
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-3.5">
        <div className="flex items-start justify-between">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Comandas & pedidos
          </p>
          <Receipt className="size-4 text-muted-foreground" />
        </div>
        <p className="mt-2 font-serif text-2xl font-bold">{data.orderCount}</p>
        <p className="mt-0.5 text-2xs text-muted-foreground">
          {data.deliveredCount} concluídos · {activeCount} em aberto
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-3.5">
        <div className="flex items-start justify-between">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ticket médio
          </p>
          <Wallet className="size-4 text-muted-foreground" />
        </div>
        <p className="mt-2 font-serif text-2xl font-bold">
          {formatCatalogPrice(data.ticketCents)}
        </p>
        <p className="mt-0.5 text-2xs text-muted-foreground">
          {formatCatalogPrice(data.pickupCents)} balcão ·{' '}
          {formatCatalogPrice(data.deliveryCents)} entrega
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-3.5">
        <div className="flex items-start justify-between">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Em aberto agora
          </p>
          <Clock className="size-4 text-muted-foreground" />
        </div>
        <p className="mt-2 font-serif text-2xl font-bold">{activeCount}</p>
        <p className="mt-0.5 text-2xs text-muted-foreground">
          Pedidos aguardando ação
        </p>
      </div>
    </div>
  );
}
