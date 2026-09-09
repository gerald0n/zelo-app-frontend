import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import { createAdminCoupon, listAdminCoupons } from '@/modules/admin/coupons';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  code: z.string().trim().min(3).max(32),
  discountType: z.enum(['percent', 'fixed', 'free_shipping']),
  discountValue: z.number().int().min(0).max(1_000_000),
  maxUses: z.number().int().min(1).max(1_000_000),
  isActive: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export async function GET() {
  const result = await listAdminCoupons();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ coupons: result.data });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados do cupom inválidos.',
        },
      },
      { status: 400 },
    );
  }

  const result = await createAdminCoupon(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ coupon: result.data }, { status: 201 });
}
