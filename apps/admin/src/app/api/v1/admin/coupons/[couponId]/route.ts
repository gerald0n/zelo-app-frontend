import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import { deleteAdminCoupon, updateAdminCoupon } from '@/modules/admin/coupons';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ couponId: string }> };

const patchSchema = z.object({
  code: z.string().trim().min(3).max(32).optional(),
  discountType: z.enum(['percent', 'fixed', 'free_shipping']).optional(),
  discountValue: z.number().int().min(0).max(1_000_000).optional(),
  maxUses: z.number().int().min(1).max(1_000_000).optional(),
  isActive: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const { couponId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } },
      { status: 400 },
    );
  }

  const result = await updateAdminCoupon({ couponId, input: parsed.data });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ coupon: result.data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { couponId } = await context.params;
  const result = await deleteAdminCoupon(couponId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ ok: true });
}
