import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import { cancelAdminOrder } from '@/modules/admin/orders';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderId: string }> };

const bodySchema = z.object({
  reason: z.string().min(3),
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
          message: 'Informe o motivo do cancelamento.',
        },
      },
      { status: 400 },
    );
  }

  const result = await cancelAdminOrder({
    orderId,
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
