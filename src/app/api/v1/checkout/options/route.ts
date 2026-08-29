import { NextResponse } from 'next/server';
import { getPublicStore } from '@/modules/catalog/catalog-repository';
import { getSchedulingSnapshot } from '@/modules/scheduling/schedule';
import { httpStatusFor } from '@/lib/errors';
import { PEREIRO_URBAN_NEIGHBORHOODS } from '@/modules/delivery';

export const dynamic = 'force-dynamic';

export async function GET() {
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
        error: { code: 'NOT_FOUND', message: 'Loja não encontrada.' },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    store: {
      id: storeResult.data.id,
      name: storeResult.data.name,
      addressLine: storeResult.data.addressLine,
      city: storeResult.data.city,
      state: storeResult.data.state,
      latitude: storeResult.data.latitude,
      longitude: storeResult.data.longitude,
      freeDeliveryRadiusMeters: storeResult.data.freeDeliveryRadiusMeters,
      fixedDeliveryFeeCents: storeResult.data.fixedDeliveryFeeCents,
      pixCopyPaste: storeResult.data.pixCopyPaste,
      whatsappE164: storeResult.data.whatsappE164,
      acceptsPayments: storeResult.data.acceptsPayments,
    },
    neighborhoods: PEREIRO_URBAN_NEIGHBORHOODS.map((item) => ({
      id: item.id,
      name: item.name,
    })),
    scheduling: getSchedulingSnapshot(storeResult.data),
  });
}
