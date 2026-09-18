'use client';

import { Loader2, Sheet, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { statusLabel } from '@/modules/orders/types';
import type { OrderStatus, PaymentMethod } from '@/modules/orders/types';
import { paymentMethodLabel } from '@/lib/admin/payment-method-label';
import {
  PERIOD_LABEL,
  type CustomRange,
  type DashboardPeriod,
} from '@/modules/admin/dashboard';
import {
  ORDER_REPORT_PAYMENT_METHODS,
  ORDER_REPORT_STATUSES,
  type OrderReportDeliveryMethod,
} from '@/modules/admin/orders-report';

const PERIODS: DashboardPeriod[] = ['today', 'yesterday', '7d', '30d', 'custom'];

export type DeliveryFilter = 'all' | OrderReportDeliveryMethod;
export type StatusFilter = 'all' | OrderStatus;
export type PaymentFilter = 'all' | PaymentMethod;
export type DiscountFilter = 'all' | 'yes' | 'no';

export type OrdersReportFiltersValue = {
  period: DashboardPeriod;
  customRange: CustomRange;
  deliveryMethod: DeliveryFilter;
  status: StatusFilter;
  paymentMethod: PaymentFilter;
  hasDiscount: DiscountFilter;
  minDistanceKm: string;
  maxDistanceKm: string;
};

const selectClass =
  'h-9 min-w-0 rounded-md border border-border bg-card px-2.5 text-xs font-semibold text-foreground outline-none focus-visible:border-ring';

export function hasActiveFilters(value: OrdersReportFiltersValue): boolean {
  return (
    value.deliveryMethod !== 'all' ||
    value.status !== 'all' ||
    value.paymentMethod !== 'all' ||
    value.hasDiscount !== 'all' ||
    Boolean(value.minDistanceKm) ||
    Boolean(value.maxDistanceKm)
  );
}

export function describeFilters(value: OrdersReportFiltersValue): string {
  if (!hasActiveFilters(value)) return 'Nenhum filtro adicional';
  return [
    value.deliveryMethod !== 'all'
      ? value.deliveryMethod === 'delivery'
        ? 'Entrega'
        : 'Retirada'
      : null,
    value.status !== 'all' ? statusLabel(value.status) : null,
    value.paymentMethod !== 'all' ? paymentMethodLabel(value.paymentMethod) : null,
    value.hasDiscount !== 'all'
      ? value.hasDiscount === 'yes'
        ? 'Com desconto'
        : 'Sem desconto'
      : null,
    value.minDistanceKm ? `Distância ≥ ${value.minDistanceKm} km` : null,
    value.maxDistanceKm ? `Distância ≤ ${value.maxDistanceKm} km` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function defaultOrdersReportFilters(): OrdersReportFiltersValue {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayInput = `${yyyy}-${mm}-${dd}`;
  return {
    period: '30d',
    customRange: { from: todayInput, to: todayInput },
    deliveryMethod: 'all',
    status: 'all',
    paymentMethod: 'all',
    hasDiscount: 'all',
    minDistanceKm: '',
    maxDistanceKm: '',
  };
}

type Props = {
  value: OrdersReportFiltersValue;
  onChange: (patch: Partial<OrdersReportFiltersValue>) => void;
  onExport: () => void;
  exportDisabled: boolean;
  exporting: boolean;
};

export function OrdersReportFilters({
  value,
  onChange,
  onExport,
  exportDisabled,
  exporting,
}: Props) {
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-bold uppercase tracking-widest text-primary">
            Pedidos
          </p>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">
            Relatório detalhado
          </h1>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Uma linha por pedido, com custos e distância de entrega — para
            analisar vendas e a operação de delivery.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <div className="flex flex-wrap justify-end gap-0.5 rounded-lg border border-border bg-card p-0.5">
              {PERIODS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onChange({ period: item })}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                    value.period === item
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {PERIOD_LABEL[item]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onExport}
              disabled={exportDisabled || exporting}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sheet className="size-3.5" />
              )}
              Exportar .xlsx
            </button>
          </div>
          {value.period === 'custom' ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={value.customRange.from}
                max={value.customRange.to}
                onChange={(e) =>
                  onChange({
                    customRange: { ...value.customRange, from: e.target.value },
                  })
                }
                className="h-9 w-[9.5rem] text-xs"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                value={value.customRange.to}
                min={value.customRange.from}
                onChange={(e) =>
                  onChange({
                    customRange: { ...value.customRange, to: e.target.value },
                  })
                }
                className="h-9 w-[9.5rem] text-xs"
              />
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2.5">
        <select
          value={value.deliveryMethod}
          onChange={(e) =>
            onChange({ deliveryMethod: e.target.value as DeliveryFilter })
          }
          className={selectClass}
        >
          <option value="all">Todos os tipos</option>
          <option value="delivery">Entrega</option>
          <option value="pickup">Retirada</option>
        </select>

        <select
          value={value.status}
          onChange={(e) => onChange({ status: e.target.value as StatusFilter })}
          className={selectClass}
        >
          <option value="all">Todos os status</option>
          {ORDER_REPORT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>

        <select
          value={value.paymentMethod}
          onChange={(e) =>
            onChange({ paymentMethod: e.target.value as PaymentFilter })
          }
          className={selectClass}
        >
          <option value="all">Todas as formas de pagamento</option>
          {ORDER_REPORT_PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {paymentMethodLabel(m)}
            </option>
          ))}
        </select>

        <select
          value={value.hasDiscount}
          onChange={(e) =>
            onChange({ hasDiscount: e.target.value as DiscountFilter })
          }
          className={selectClass}
        >
          <option value="all">Com ou sem desconto</option>
          <option value="yes">Com desconto</option>
          <option value="no">Sem desconto</option>
        </select>

        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            placeholder="Dist. mín. (km)"
            value={value.minDistanceKm}
            onChange={(e) => onChange({ minDistanceKm: e.target.value })}
            className="h-9 w-32 text-xs"
          />
          <span className="text-xs text-muted-foreground">a</span>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            placeholder="Dist. máx. (km)"
            value={value.maxDistanceKm}
            onChange={(e) => onChange({ maxDistanceKm: e.target.value })}
            className="h-9 w-32 text-xs"
          />
        </div>

        {hasActiveFilters(value) ? (
          <button
            type="button"
            onClick={() =>
              onChange({
                deliveryMethod: 'all',
                status: 'all',
                paymentMethod: 'all',
                hasDiscount: 'all',
                minDistanceKm: '',
                maxDistanceKm: '',
              })
            }
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent"
          >
            <X className="size-3.5" />
            Limpar
          </button>
        ) : null}
      </div>
    </>
  );
}
