import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { getCachedPublicStore } from '@/modules/catalog/cached-catalog';
import { canPlaceImmediateOrder } from '@/modules/scheduling/schedule';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Config da loja vem do cache; `isOpen` é recalculado agora (depende da hora).
  const result = await getCachedPublicStore();
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
