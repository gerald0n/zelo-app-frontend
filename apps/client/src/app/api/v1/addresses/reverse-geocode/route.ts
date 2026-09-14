import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/http';
import { clientIpFromRequest } from '@/lib/request-ip';
import { reverseGeocodeCoords } from '@/modules/delivery/maps';
import { enforceIpRateLimit } from '@/modules/security/rate-limit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export async function POST(request: Request) {
  const limited = await enforceIpRateLimit({
    kind: 'reverse_geocode',
    ip: clientIpFromRequest(request),
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!limited.ok) return jsonError(limited.error);

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Coordenadas inválidas.',
        },
      },
      { status: 400 },
    );
  }

  const result = await reverseGeocodeCoords(parsed.data);
  if (!result.ok) return jsonError(result.error);

  return NextResponse.json({
    address: {
      street: result.data.street ?? '',
      number: result.data.number ?? '',
      neighborhood: result.data.neighborhood ?? '',
      formattedAddress: result.data.formattedAddress,
    },
  });
}
