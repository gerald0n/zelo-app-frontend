import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { quoteDelivery } from '@/modules/delivery';
import { getPublicStore } from '@/modules/catalog/catalog-repository';
import {
  canPlaceImmediateOrder,
  listAvailableScheduleDates,
  listAvailableScheduleTimes,
} from '@/modules/scheduling/schedule';
import type { CatalogStore } from '@/modules/catalog/types';
import type { CreateOrderBody } from '@/modules/orders/create-order-schema';

export async function validateScheduling(
  body: CreateOrderBody,
): Promise<Result<{ scheduledFor: string | null }>> {
  const storeResult = await getPublicStore();
  if (!storeResult.ok) return storeResult;
  if (!storeResult.data) {
    return err('NOT_FOUND', 'Loja não encontrada.');
  }
  const store = storeResult.data;

  if (body.timing === 'immediate') {
    if (!canPlaceImmediateOrder(store)) {
      return err(
        'STORE_CLOSED',
        'A loja está fechada. Escolha um horário para agendar.',
      );
    }
    return ok({ scheduledFor: null });
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
  });
  if (!dates.includes(dateIso)) {
    return err('VALIDATION_ERROR', 'Data de agendamento indisponível.');
  }
  const times = listAvailableScheduleTimes(store, dateIso, body.deliveryMethod);
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

  const storeResult = await getPublicStore();
  if (!storeResult.ok) return storeResult;
  if (!storeResult.data) {
    return err('NOT_FOUND', 'Loja não encontrada.');
  }
  const store = storeResult.data;

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
      latitude: store.latitude,
      longitude: store.longitude,
      freeDeliveryRadiusMeters: store.freeDeliveryRadiusMeters,
      fixedDeliveryFeeCents: store.fixedDeliveryFeeCents,
      maxDeliveryRadiusMeters: store.maxDeliveryRadiusMeters,
      addressLine: store.addressLine,
      city: store.city,
      state: store.state,
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
