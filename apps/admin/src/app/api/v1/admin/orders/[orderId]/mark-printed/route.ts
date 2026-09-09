import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { markOrderKitchenPrinted } from '@/modules/admin/order-print-status';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { orderId } = await context.params;
  const result = await markOrderKitchenPrinted(orderId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ printedAt: result.data.printedAt });
}
