import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { listAdminCustomers, searchAdminCustomers } from '@/modules/admin/customers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (q) {
    const result = await searchAdminCustomers(q);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: httpStatusFor(result.error.code) },
      );
    }
    return NextResponse.json({ customers: result.data });
  }

  const page = Number(searchParams.get('page')) || 1;
  const result = await listAdminCustomers({ page });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json(result.data);
}
