import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { getProductReviewsView } from '@/modules/reviews';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ productId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { productId } = await context.params;
  const result = await getProductReviewsView(productId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json(result.data);
}
