import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  getAdminSatelliteLocation,
  replaceAdminSatelliteDeliverySlots,
} from '@/modules/admin/satellite-location';

export const dynamic = 'force-dynamic';

const slotSchema = z.object({
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  label: z.string().nullable(),
  sortOrder: z.number().int().min(0),
});

const putSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  slots: z.array(slotSchema).max(10),
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
  return NextResponse.json({ deliverySlots: result.data.deliverySlots });
}

/** Substitui todos os slots de entrega de UM dia da semana. */
export async function PUT(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } },
      { status: 400 },
    );
  }

  const result = await replaceAdminSatelliteDeliverySlots(
    parsed.data.weekday,
    parsed.data.slots,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ deliverySlots: result.data });
}
