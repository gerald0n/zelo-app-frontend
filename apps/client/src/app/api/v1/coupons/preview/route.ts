import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { couponPreviewSchema, previewOrderCoupon } from '@/modules/orders';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = couponPreviewSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Cupom inválido.' } },
      { status: 400 },
    );
  }

  const result = await previewOrderCoupon(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ coupon: result.data });
}
