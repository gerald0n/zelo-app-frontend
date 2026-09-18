import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { quoteDelivery } from '@/modules/delivery';
import {
  getPublicCatalog,
  getPublicStore,
  listPublicProducts,
} from '@/modules/catalog/catalog-repository';
import {
  getSatelliteLocation,
  listSatelliteProducts,
} from '@/modules/catalog/satellite-repository';
import {
  listAvailableScheduleDates,
  listAvailableScheduleTimes,
  resolveCartSchedulingRule,
} from '@/modules/scheduling/schedule';
import { isSatelliteSlotValid } from '@/modules/scheduling/satellite-slots';
import type { CatalogStore, SatelliteLocation } from '@/modules/catalog/types';
import type { CreateOrderBody } from '@/modules/orders/create-order-schema';

const MIXED_CART_MESSAGE =
  'Este pedido mistura categorias com regras de agendamento diferentes. ' +
  'Finalize uma categoria por vez.';

async function validateSatelliteScheduling(
  body: CreateOrderBody,
): Promise<Result<{ scheduledFor: string | null }>> {
  const locationResult = await getSatelliteLocation();
  if (!locationResult.ok) return locationResult;
  const location = locationResult.data;
  if (!location || location.id !== body.fulfillmentLocationId) {
    return err('NOT_FOUND', 'Unidade não encontrada.');
  }
  if (!location.isActive) {
    return err('STORE_CLOSED', 'Esta unidade está indisponível no momento.');
  }

  // Pronta entrega: só o lote curado dessa unidade. Encomenda (mesmo via
  // São Miguel): cardápio normal — vale o mesmo catálogo de Pereiro, já que
  // dá tempo de preparar qualquer sabor.
  const productsResult = body.prontaEntrega
    ? await listSatelliteProducts(location.id)
    : await listPublicProducts();
  if (!productsResult.ok) return productsResult;
  const validIds = new Set(productsResult.data.map((product) => product.id));
  const hasInvalidItem = body.items.some(
    (item) => !validIds.has(item.productId),
  );
  if (hasInvalidItem) {
    return err(
      'PRODUCT_UNAVAILABLE',
      body.prontaEntrega
        ? 'Um dos itens não está mais disponível na pronta entrega.'
        : 'Um dos itens não está disponível para esta unidade.',
    );
  }

  if (!body.scheduledFor) {
    return err('VALIDATION_ERROR', 'Informe data e horário do agendamento.');
  }
  const scheduled = new Date(body.scheduledFor);
  if (Number.isNaN(scheduled.getTime())) {
    return err('VALIDATION_ERROR', 'Data de agendamento inválida.');
  }

  const dateIso = body.scheduledFor.slice(0, 10);
  const time = body.scheduledFor.slice(11, 16);
  if (!isSatelliteSlotValid(location, dateIso, time, body.deliveryMethod)) {
    return err(
      'VALIDATION_ERROR',
      'Horário de agendamento indisponível nesta unidade.',
    );
  }

  return ok({ scheduledFor: body.scheduledFor });
}

export async function validateScheduling(
  body: CreateOrderBody,
): Promise<Result<{ scheduledFor: string | null }>> {
  if (body.fulfillmentLocationId) {
    return validateSatelliteScheduling(body);
  }

  const catalogResult = await getPublicCatalog();
  if (!catalogResult.ok) return catalogResult;
  const { store, categories, products } = catalogResult.data;
  if (!store) {
    return err('NOT_FOUND', 'Loja não encontrada.');
  }

  const productIds = body.items.map((item) => item.productId);
  const { rule, mixed } = resolveCartSchedulingRule(
    categories,
    products,
    productIds,
  );
  if (mixed) {
    return err('VALIDATION_ERROR', MIXED_CART_MESSAGE);
  }

  if (!body.scheduledFor) {
    return err('VALIDATION_ERROR', 'Informe data e horário do agendamento.');
  }

  const scheduled = new Date(body.scheduledFor);
  if (Number.isNaN(scheduled.getTime())) {
    return err('VALIDATION_ERROR', 'Data de agendamento inválida.');
  }

  const dateIso = body.scheduledFor.slice(0, 10);
  const time = body.scheduledFor.slice(11, 16);
  const dates = listAvailableScheduleDates(store, {
    deliveryMethod: body.deliveryMethod,
    rule,
  });
  if (!dates.includes(dateIso)) {
    return err('VALIDATION_ERROR', 'Data de agendamento indisponível.');
  }
  const times = listAvailableScheduleTimes(
    store,
    dateIso,
    body.deliveryMethod,
    rule,
  );
  if (!times.includes(time)) {
    return err('VALIDATION_ERROR', 'Horário de agendamento indisponível.');
  }

  return ok({ scheduledFor: body.scheduledFor });
}

function isPaymentAccepted(
  store: CatalogStore,
  method: CreateOrderBody['paymentMethod'],
) {
  return store.acceptsPayments[method];
}

export async function validatePaymentMethod(
  body: CreateOrderBody,
): Promise<Result<true>> {
  const storeResult = await getPublicStore();
  if (!storeResult.ok) return storeResult;
  if (!storeResult.data) {
    return err('NOT_FOUND', 'Loja não encontrada.');
  }
  if (!isPaymentAccepted(storeResult.data, body.paymentMethod)) {
    return err(
      'VALIDATION_ERROR',
      'Esta forma de pagamento não está disponível no momento.',
    );
  }
  return ok(true);
}

export async function resolveDeliveryFee(body: CreateOrderBody): Promise<
  Result<{
    deliveryFeeCents: number;
    routeDistanceMeters: number | null;
    address: CreateOrderBody['address'];
  }>
> {
  if (body.deliveryMethod === 'pickup') {
    return ok({
      deliveryFeeCents: 0,
      routeDistanceMeters: null,
      address: undefined,
    });
  }

  if (!body.address) {
    return err('VALIDATION_ERROR', 'Endereço é obrigatório para entrega.');
  }

  let origin: CatalogStore | SatelliteLocation;
  if (body.fulfillmentLocationId) {
    const locationResult = await getSatelliteLocation();
    if (!locationResult.ok) return locationResult;
    if (
      !locationResult.data ||
      locationResult.data.id !== body.fulfillmentLocationId
    ) {
      return err('NOT_FOUND', 'Unidade não encontrada.');
    }
    origin = locationResult.data;
  } else {
    const storeResult = await getPublicStore();
    if (!storeResult.ok) return storeResult;
    if (!storeResult.data) {
      return err('NOT_FOUND', 'Loja não encontrada.');
    }
    origin = storeResult.data;
  }

  const quote = await quoteDelivery(
    {
      street: body.address.street,
      number: body.address.number,
      neighborhood: body.address.neighborhood,
      complement: body.address.complement,
      referencePoint: body.address.referencePoint,
      city: body.address.city,
      state: body.address.state,
      postalCode: body.address.postalCode,
      latitude: body.address.latitude,
      longitude: body.address.longitude,
    },
    {
      latitude: origin.latitude,
      longitude: origin.longitude,
      freeDeliveryRadiusMeters: origin.freeDeliveryRadiusMeters,
      fixedDeliveryFeeCents: origin.fixedDeliveryFeeCents,
      maxDeliveryRadiusMeters: origin.maxDeliveryRadiusMeters,
      addressLine: origin.addressLine,
      city: origin.city,
      state: origin.state,
    },
  );

  if (!quote.ok) return quote;

  if (!quote.data.inServiceArea) {
    return err(
      'OUT_OF_DELIVERY_AREA',
      quote.data.message ??
        'Endereço fora da área urbana. Escolha retirada na loja.',
    );
  }

  return ok({
    deliveryFeeCents: quote.data.deliveryFeeCents,
    routeDistanceMeters: quote.data.routeDistanceMeters,
    address: {
      ...body.address,
      latitude: quote.data.latitude,
      longitude: quote.data.longitude,
    },
  });
}
