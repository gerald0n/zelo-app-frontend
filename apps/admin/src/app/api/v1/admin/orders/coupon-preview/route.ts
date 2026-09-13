import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { requireAdmin } from '@/modules/admin/auth';
import {
  couponPreviewSchema,
  previewOrderCoupon,
} from '@/modules/orders/coupon-preview';

export const dynamic = 'force-dynamic';

/** Preview de cupom pra comanda manual — mesma checagem read-only do checkout do cliente. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: httpStatusFor(auth.error.code) },
    );
  }

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
