import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  deleteAdminPromotion,
  updateAdminPromotion,
} from '@/modules/admin/promotions';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ promotionId: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  scope: z.enum(['store', 'category', 'products']).optional(),
  discountPercent: z.number().gt(0).max(100).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  productIds: z.array(z.string().uuid()).optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const { promotionId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos.',
        },
      },
      { status: 400 },
    );
  }

  const result = await updateAdminPromotion(promotionId, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ promotion: result.data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { promotionId } = await context.params;
  const result = await deleteAdminPromotion(promotionId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ ok: true });
}
