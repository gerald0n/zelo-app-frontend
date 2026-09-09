import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  getProductReviewsView,
  submitProductReview,
  REVIEW_COMMENT_MAX,
} from '@/modules/reviews';

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

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(REVIEW_COMMENT_MAX).optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const { productId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Informe uma nota de 1 a 5 estrelas.',
        },
      },
      { status: 400 },
    );
  }

  const result = await submitProductReview({
    productId,
    rating: parsed.data.rating,
    comment: parsed.data.comment ?? null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ review: result.data });
}
