import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import { moderateReview } from '@/modules/admin/reviews';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ reviewId: string }> };

const patchSchema = z.object({
  status: z.enum(['pending', 'approved', 'hidden']).optional(),
  isFeatured: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const { reviewId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } },
      { status: 400 },
    );
  }

  const result = await moderateReview({ id: reviewId, ...parsed.data });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ review: result.data });
}
