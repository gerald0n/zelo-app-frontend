import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { reorderCustomerOrder } from '@/modules/orders/customer-orders';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { orderId } = await context.params;
  const result = await reorderCustomerOrder(orderId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({
    items: result.data.items,
    unavailableProducts: result.data.unavailableProducts,
    unavailableAddOns: result.data.unavailableAddOns,
  });
}
