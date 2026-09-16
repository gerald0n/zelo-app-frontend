import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { getCachedPublicPromoModalBanners } from '@/modules/catalog/cached-catalog';

export const dynamic = 'force-dynamic';

// Cacheado internamente (ver CATALOG_CACHE_TTL_SECONDS); banner modal (popup).
export async function GET() {
  const result = await getCachedPublicPromoModalBanners();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ banners: result.data });
}
