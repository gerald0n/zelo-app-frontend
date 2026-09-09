import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import {
  countPendingProductReviews,
  listAdminProductReviews,
} from '@/modules/admin/product-reviews';
import type { ReviewStatus } from '@/modules/admin/types';

export const dynamic = 'force-dynamic';

const STATUSES: ReviewStatus[] = ['pending', 'approved', 'hidden'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get('count') === 'pending') {
    const result = await countPendingProductReviews();
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: httpStatusFor(result.error.code) },
      );
    }
    return NextResponse.json({ pending: result.data });
  }

  const statusParam = searchParams.get('status');
  const status = STATUSES.includes(statusParam as ReviewStatus)
    ? (statusParam as ReviewStatus)
    : undefined;

  const result = await listAdminProductReviews(status);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ reviews: result.data });
}
