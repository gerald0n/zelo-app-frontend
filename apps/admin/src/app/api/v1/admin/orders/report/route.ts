import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { getOrdersReport } from '@/modules/admin/orders-report-query';
import {
  ORDER_REPORT_DELIVERY_METHODS,
  ORDER_REPORT_PAYMENT_METHODS,
  ORDER_REPORT_STATUSES,
  type OrderReportDeliveryMethod,
  type OrdersReportFilters,
} from '@/modules/admin/orders-report';
import type { OrderStatus, PaymentMethod } from '@/modules/orders/types';

export const dynamic = 'force-dynamic';

function parseFilters(params: URLSearchParams): OrdersReportFilters | null {
  const from = params.get('from');
  const to = params.get('to');
  if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    return null;
  }
  if (Date.parse(to) <= Date.parse(from)) return null;

  const deliveryMethodRaw = params.get('deliveryMethod');
  const statusRaw = params.get('status');
  const paymentMethodRaw = params.get('paymentMethod');
  const minDistanceKm = params.get('minDistanceKm');
  const maxDistanceKm = params.get('maxDistanceKm');
  const hasDiscountRaw = params.get('hasDiscount');

  if (
    deliveryMethodRaw &&
    !ORDER_REPORT_DELIVERY_METHODS.includes(
      deliveryMethodRaw as OrderReportDeliveryMethod,
    )
  ) {
    return null;
  }
  if (statusRaw && !ORDER_REPORT_STATUSES.includes(statusRaw as OrderStatus)) {
    return null;
  }
  if (
    paymentMethodRaw &&
    !ORDER_REPORT_PAYMENT_METHODS.includes(paymentMethodRaw as PaymentMethod)
  ) {
    return null;
  }
  if (hasDiscountRaw && hasDiscountRaw !== 'true' && hasDiscountRaw !== 'false') {
    return null;
  }

  return {
    from,
    to,
    deliveryMethod: (deliveryMethodRaw as OrderReportDeliveryMethod) || undefined,
    status: (statusRaw as OrderStatus) || undefined,
    paymentMethod: (paymentMethodRaw as PaymentMethod) || undefined,
    minDistanceMeters: minDistanceKm ? Math.round(Number(minDistanceKm) * 1000) : undefined,
    maxDistanceMeters: maxDistanceKm ? Math.round(Number(maxDistanceKm) * 1000) : undefined,
    hasDiscount: hasDiscountRaw ? hasDiscountRaw === 'true' : undefined,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = parseFilters(searchParams);
  if (!filters) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Parâmetros inválidos.' } },
      { status: 400 },
    );
  }

  const result = await getOrdersReport(filters);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json(result.data);
}
