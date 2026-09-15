import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { listPublicTestimonials } from '@/modules/reviews';

// Depoimentos são cacheados internamente (ver TESTIMONIALS_CACHE_TTL_SECONDS);
// endpoint público usado pelo site institucional (outro projeto Vercel).
export async function GET() {
  const result = await listPublicTestimonials();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ testimonials: result.data });
}
