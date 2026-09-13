import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { listAdminOrderHistory } from '@/modules/admin/order-history';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const result = await listAdminOrderHistory({
    q: searchParams.get('q') ?? undefined,
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    page: Number(searchParams.get('page')) || undefined,
    pageSize: Number(searchParams.get('pageSize')) || undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json(result.data);
}
