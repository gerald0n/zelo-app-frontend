import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  createSavedAddress,
  listSavedAddresses,
} from '@/modules/customers/addresses';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
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
