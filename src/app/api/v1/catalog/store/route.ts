import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { getPublicStore } from '@/modules/catalog/catalog-repository';
import { canPlaceImmediateOrder } from '@/modules/scheduling/schedule';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await getPublicStore();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  const store = result.data;
  return NextResponse.json({
    store,
    isOpen: store ? canPlaceImmediateOrder(store) : false,
  });
}
