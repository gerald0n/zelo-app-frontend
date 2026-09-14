import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import { jsonError } from '@/lib/http';
import { clientIpFromRequest } from '@/lib/request-ip';
import {
  createSavedAddress,
  listSavedAddresses,
} from '@/modules/customers/addresses';
import { enforceIpRateLimit } from '@/modules/security/rate-limit';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  label: z.string().trim().max(40).optional(),
  // Sem `.min(1)`: coordenada confirmada (GPS/pin) basta quando o Google não
  // reconhece a rua.
  street: z.string().trim().default(''),
  number: z.string().trim().default(''),
  neighborhood: z.string().trim().default(''),
  complement: z.string().optional(),
  referencePoint: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isDefault: z.boolean().optional(),
  locationSource: z
    .enum(['geocoded', 'current_location', 'manual_pin'])
    .optional(),
  locationAccuracyMeters: z.number().optional(),
  locationDiverged: z.boolean().optional(),
  formattedAddress: z.string().optional(),
});

export async function GET() {
  const result = await listSavedAddresses();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ addresses: result.data });
}

export async function POST(request: Request) {
  const limited = await enforceIpRateLimit({
    kind: 'address_write',
    ip: clientIpFromRequest(request),
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (!limited.ok) return jsonError(limited.error);

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados de endereço inválidos.',
        },
      },
      { status: 400 },
    );
  }

  const result = await createSavedAddress(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ address: result.data }, { status: 201 });
}
