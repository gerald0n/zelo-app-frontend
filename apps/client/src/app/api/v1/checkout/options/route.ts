import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublicCatalog } from '@/modules/catalog/catalog-repository';
import {
  buildSchedulingSnapshot,
  resolveCartSchedulingRule,
} from '@/modules/scheduling/schedule';
import { getCatalogStoreHoursLabel } from '@/modules/catalog/store-hours';
import { httpStatusFor } from '@/lib/errors';
import { PEREIRO_URBAN_NEIGHBORHOODS } from '@/modules/delivery';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  productIds: z.array(z.string().uuid()).max(200).optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json ?? {});
  const productIds = parsed.success ? (parsed.data.productIds ?? []) : [];

  const catalogResult = await getPublicCatalog();
  if (!catalogResult.ok) {
    return NextResponse.json(
      { error: catalogResult.error },
      { status: httpStatusFor(catalogResult.error.code) },
    );
  }
  const { store, categories, products } = catalogResult.data;
  if (!store) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Loja não encontrada.' } },
      { status: 404 },
    );
  }

  const { rule, mixed } = resolveCartSchedulingRule(
    categories,
    products,
    productIds,
  );

  return NextResponse.json({
    store: {
      id: store.id,
      name: store.name,
      addressLine: store.addressLine,
      city: store.city,
      state: store.state,
      latitude: store.latitude,
      longitude: store.longitude,
      freeDeliveryRadiusMeters: store.freeDeliveryRadiusMeters,
      fixedDeliveryFeeCents: store.fixedDeliveryFeeCents,
      whatsappE164: store.whatsappE164,
      acceptsPayments: store.acceptsPayments,
    },
    neighborhoods: PEREIRO_URBAN_NEIGHBORHOODS.map((item) => ({
      id: item.id,
      name: item.name,
    })),
    scheduling: {
      ...buildSchedulingSnapshot(store, rule),
      mixedCart: mixed,
      allowSameDay: rule.allowSameDay,
      hoursLabel: getCatalogStoreHoursLabel(store),
    },
  });
}
