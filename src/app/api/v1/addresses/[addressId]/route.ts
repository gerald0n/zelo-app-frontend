import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  archiveSavedAddress,
  updateSavedAddress,
} from '@/modules/customers/addresses';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ addressId: string }> };

const updateSchema = z.object({
  label: z.string().trim().max(40).optional(),
  street: z.string().trim().min(1),
  number: z.string().trim().min(1),
  neighborhood: z.string().trim().min(1),
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

export async function DELETE(_request: Request, context: RouteContext) {
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
