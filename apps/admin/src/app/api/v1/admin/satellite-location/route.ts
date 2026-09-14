import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  getAdminSatelliteLocation,
  updateAdminSatelliteLocation,
} from '@/modules/admin/satellite-location';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  addressLine: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  state: z.string().trim().length(2).optional(),
  postalCode: z.string().trim().nullable().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  freeDeliveryRadiusMeters: z.number().int().min(0).optional(),
  fixedDeliveryFeeCents: z.number().int().min(0).optional(),
  maxDeliveryRadiusMeters: z.number().int().min(0).optional(),
  minLeadMinutes: z.number().int().min(0).max(1440).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const result = await getAdminSatelliteLocation();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ location: result.data });
}

export async function PATCH(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } },
      { status: 400 },
    );
  }

  const result = await updateAdminSatelliteLocation(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ location: result.data });
}
