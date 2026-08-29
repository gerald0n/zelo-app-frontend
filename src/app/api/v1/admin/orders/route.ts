import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { listAdminOrders } from '@/modules/admin/orders';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scopeParam = searchParams.get('scope');
  const scope =
    scopeParam === 'active' ||
    scopeParam === 'scheduled' ||
    scopeParam === 'done' ||
    scopeParam === 'all'
      ? scopeParam
      : 'all';
  const q = searchParams.get('q') ?? undefined;

  const result = await listAdminOrders({ scope, q });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ orders: result.data });
}
