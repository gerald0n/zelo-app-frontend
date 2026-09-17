import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  getAdminOrderRescheduleOptions,
  rescheduleAdminOrder,
} from '@/modules/admin/admin-orders-reschedule';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { orderId } = await context.params;
  const result = await getAdminOrderRescheduleOptions(orderId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ options: result.data });
}

const bodySchema = z.object({
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/),
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
          message: 'Informe a data e o horário do novo agendamento.',
        },
      },
      { status: 400 },
    );
  }

  const result = await rescheduleAdminOrder({
    orderId,
    scheduledDate: parsed.data.scheduledDate,
    scheduledTime: parsed.data.scheduledTime,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ order: result.data });
}
