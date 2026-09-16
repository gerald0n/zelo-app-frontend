import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { getCachedPublicFaqItems } from '@/modules/catalog/cached-catalog';

export const dynamic = 'force-dynamic';

// Cacheado internamente (ver CATALOG_CACHE_TTL_SECONDS); popover de ajuda.
export async function GET() {
  const result = await getCachedPublicFaqItems();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ items: result.data });
}
