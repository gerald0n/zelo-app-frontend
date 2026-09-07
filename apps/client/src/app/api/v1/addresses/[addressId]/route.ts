import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import { jsonError } from '@/lib/http';
import { clientIpFromRequest } from '@/lib/request-ip';
import {
  archiveSavedAddress,
  updateSavedAddress,
} from '@/modules/customers/addresses';
import { enforceIpRateLimit } from '@/modules/security/rate-limit';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ addressId: string }> };

function limitAddressWrite(request: Request) {
  return enforceIpRateLimit({
    kind: 'address_write',
    ip: clientIpFromRequest(request),
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
}

const updateSchema = z.object({
  label: z.string().trim().max(40).optional(),
  street: z.string().trim().min(1),
  number: z.string().trim().min(1),
  neighborhood: z.string().trim().default(''),
  complement: z.string().optional(),
  referencePoint: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const limited = await limitAddressWrite(request);
  if (!limited.ok) return jsonError(limited.error);

  const { addressId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
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

  const result = await updateSavedAddress(addressId, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ address: result.data });
}

export async function DELETE(request: Request, context: RouteContext) {
  const limited = await limitAddressWrite(request);
  if (!limited.ok) return jsonError(limited.error);

  const { addressId } = await context.params;
  const result = await archiveSavedAddress(addressId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ ok: true });
}
