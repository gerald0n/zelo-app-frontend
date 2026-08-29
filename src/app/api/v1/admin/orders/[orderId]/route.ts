import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { getAdminOrder } from '@/modules/admin/orders';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { orderId } = await context.params;
  const result = await getAdminOrder(orderId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ order: result.data });
}
