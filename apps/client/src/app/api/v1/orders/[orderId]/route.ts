import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { getCustomerOrder } from '@/modules/orders/customer-orders';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { orderId } = await context.params;
  const result = await getCustomerOrder(orderId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ order: result.data });
}
