import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  listAdminBusinessHours,
  replaceAdminBusinessHours,
} from '@/modules/admin/catalog';

export const dynamic = 'force-dynamic';

const hourSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  isClosed: z.boolean(),
  deliveryEnabled: z.boolean(),
  pickupEnabled: z.boolean(),
});

const putSchema = z.object({
  hours: z.array(hourSchema).length(7),
});

export async function GET() {
  const result = await listAdminBusinessHours();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ hours: result.data });
}

export async function PUT(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Informe os 7 horários semanais.',
        },
      },
      { status: 400 },
    );
  }

  const result = await replaceAdminBusinessHours(parsed.data.hours);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ hours: result.data });
}
