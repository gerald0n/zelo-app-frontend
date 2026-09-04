import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublicStore } from '@/modules/catalog/catalog-repository';
import { quoteDelivery } from '@/modules/delivery';
import { httpStatusFor } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  street: z.string().min(1),
  number: z.string().min(1),
  neighborhood: z.string().optional().default(''),
  complement: z.string().optional(),
  referencePoint: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
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

  const storeResult = await getPublicStore();
  if (!storeResult.ok) {
    return NextResponse.json(
      { error: storeResult.error },
      { status: httpStatusFor(storeResult.error.code) },
    );
  }
  if (!storeResult.data) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Loja não encontrada.',
        },
      },
      { status: 404 },
    );
  }

  const store = storeResult.data;
  const quote = await quoteDelivery(parsed.data, {
    latitude: store.latitude,
    longitude: store.longitude,
    freeDeliveryRadiusMeters: store.freeDeliveryRadiusMeters,
    fixedDeliveryFeeCents: store.fixedDeliveryFeeCents,
    maxDeliveryRadiusMeters: store.maxDeliveryRadiusMeters,
    addressLine: store.addressLine,
    city: store.city,
    state: store.state,
  });

  if (!quote.ok) {
    return NextResponse.json(
      { error: quote.error },
      { status: httpStatusFor(quote.error.code) },
    );
  }

  return NextResponse.json({ validation: quote.data });
}
