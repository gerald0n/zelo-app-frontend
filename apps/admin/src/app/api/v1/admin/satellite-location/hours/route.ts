import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  getAdminSatelliteLocation,
  replaceAdminSatelliteHours,
} from '@/modules/admin/satellite-location';

export const dynamic = 'force-dynamic';

const hourSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  isClosed: z.boolean(),
  pickupOpensAt: z.string().nullable(),
  pickupClosesAt: z.string().nullable(),
  deliveryEnabled: z.boolean(),
});

const putSchema = z.object({
  hours: z.array(hourSchema).length(7),
});

export async function GET() {
  const result = await getAdminSatelliteLocation();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  if (!result.data) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Unidade não encontrada.' } },
      { status: 404 },
    );
  }
  return NextResponse.json({ hours: result.data.hours });
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

  const result = await replaceAdminSatelliteHours(parsed.data.hours);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ hours: result.data });
}
