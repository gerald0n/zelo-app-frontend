import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { listUnprintedKitchenOrders } from '@/modules/admin/order-print-status';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await listUnprintedKitchenOrders();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ orders: result.data });
}
