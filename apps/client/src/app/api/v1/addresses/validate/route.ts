import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublicStore } from '@/modules/catalog/catalog-repository';
import { getSatelliteLocation } from '@/modules/catalog/satellite-repository';
import { quoteDelivery } from '@/modules/delivery';
import { httpStatusFor } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  // Sem `.min(1)`: quando há lat/lng confirmada (GPS/pin), rua e número
  // deixam de ser obrigatórios — `quoteDelivery` exige um dos dois.
  street: z.string().default(''),
  number: z.string().default(''),
  neighborhood: z.string().optional().default(''),
  complement: z.string().optional(),
  referencePoint: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  fulfillmentLocation: z.enum(['pereiro', 'sao_miguel']).optional(),
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

  const originResult =
    parsed.data.fulfillmentLocation === 'sao_miguel'
      ? await getSatelliteLocation()
      : await getPublicStore();

  if (!originResult.ok) {
    return NextResponse.json(
      { error: originResult.error },
      { status: httpStatusFor(originResult.error.code) },
    );
  }
  const isSatelliteInactive =
    parsed.data.fulfillmentLocation === 'sao_miguel' &&
    originResult.data != null &&
    'isActive' in originResult.data &&
    !originResult.data.isActive;

  if (!originResult.data || isSatelliteInactive) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message:
            parsed.data.fulfillmentLocation === 'sao_miguel'
              ? 'Unidade não encontrada.'
              : 'Loja não encontrada.',
        },
      },
      { status: 404 },
    );
  }

  const origin = originResult.data;
  const quote = await quoteDelivery(parsed.data, {
    latitude: origin.latitude,
    longitude: origin.longitude,
    freeDeliveryRadiusMeters: origin.freeDeliveryRadiusMeters,
    fixedDeliveryFeeCents: origin.fixedDeliveryFeeCents,
    maxDeliveryRadiusMeters: origin.maxDeliveryRadiusMeters,
    addressLine: origin.addressLine,
    city: origin.city,
    state: origin.state,
  });

  if (!quote.ok) {
    return NextResponse.json(
      { error: quote.error },
      { status: httpStatusFor(quote.error.code) },
    );
  }

  return NextResponse.json({ validation: quote.data });
}
