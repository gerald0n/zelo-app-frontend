import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import { transitionAdminOrderStatus } from '@/modules/admin/orders';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderId: string }> };

const bodySchema = z.object({
  newStatus: z.enum([
    'received',
    'confirmed',
    'in_production',
    'ready_for_delivery',
    'ready_for_pickup',
    'out_for_delivery',
    'delivered',
    'cancelled',
  ]),
  reason: z.string().nullable().optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const { orderId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Status inválido.',
        },
      },
      { status: 400 },
    );
  }

  const result = await transitionAdminOrderStatus({
    orderId,
    newStatus: parsed.data.newStatus,
    reason: parsed.data.reason,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ order: result.data });
}
