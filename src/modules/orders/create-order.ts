import 'server-only';

import { z } from 'zod';
import { hasCustomerName } from '@/modules/auth/customer-name';
import { err, ok, type AppError, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { quoteDelivery, MAX_DELIVERY_RADIUS_METERS } from '@/modules/delivery';
import { getPublicStore } from '@/modules/catalog/catalog-repository';
import {
  clearCustomerCart,
  getCustomerCartId,
} from '@/modules/carts/persist-cart';
import {
  canPlaceImmediateOrder,
  listAvailableScheduleDates,
  listAvailableScheduleTimes,
} from '@/modules/scheduling/schedule';
import {
  ensureCustomerRecord,
  findIdempotentResponse,
  hashIdempotencyPayload,
  resolveCustomerForCheckout,
  saveIdempotentResponse,
} from '@/modules/orders/customer';
import { createOrderPixCharge } from '@/modules/payments';
import type { CatalogStore } from '@/modules/catalog/types';

const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  customerNote: z.string().max(500).optional(),
  addOns: z
    .array(
      z.object({
        addOnId: z.string().uuid(),
        quantity: z.number().int().positive().default(1),
      }),
    )
    .default([]),
});

const addressSchema = z.object({
  street: z.string().min(1),
  number: z.string().min(1),
  neighborhood: z.string().optional().default(''),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().optional(),
  complement: z.string().optional(),
  referencePoint: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
});

export const createOrderBodySchema = z.object({
  timing: z.enum(['immediate', 'scheduled']),
  scheduledFor: z.string().optional(),
  deliveryMethod: z.enum(['delivery', 'pickup']),
  paymentMethod: z.enum(['pix', 'cash', 'card']),
  needsChange: z.boolean().optional(),
  changeForAmountCents: z.number().int().positive().optional(),
  customerNote: z.string().max(1000).optional(),
  address: addressSchema.optional(),
  items: z.array(orderItemSchema).min(1),
});

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;

export type CreatedOrderSummary = {
  id: string;
  orderNumber: number;
  status: string;
  totalCents: number;
  deliveryFeeCents: number;
  subtotalCents: number;
  routeDistanceMeters: number | null;
};

export type CreatedOrderPix = {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string | null;
  expiresAt: string;
};

function mapRpcError(message: string): AppError {
  const lower = message.toLowerCase();
  if (lower.includes('não autenticado') || lower.includes('autorizado')) {
    return {
      code: 'UNAUTHENTICATED',
      message: 'Faça login para concluir o pedido.',
    };
  }
  if (lower.includes('indisponível') || lower.includes('inválido')) {
    return { code: 'PRODUCT_UNAVAILABLE', message };
  }
  if (lower.includes('endereço') || lower.includes('área')) {
    return { code: 'OUT_OF_DELIVERY_AREA', message };
  }
  if (lower.includes('troco')) {
    return { code: 'VALIDATION_ERROR', message };
  }
  if (lower.includes('agend')) {
    return { code: 'STORE_CLOSED', message };
  }
  return {
    code: 'INTERNAL_ERROR',
    message: 'Não foi possível criar o pedido.',
  };
}

async function validateScheduling(
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

async function validatePaymentMethod(
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

async function resolveDeliveryFee(body: CreateOrderBody): Promise<
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
      maxDeliveryRadiusMeters: MAX_DELIVERY_RADIUS_METERS,
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

function toRpcPayload(
  body: CreateOrderBody,
  delivery: {
    deliveryFeeCents: number;
    routeDistanceMeters: number | null;
    address: CreateOrderBody['address'];
  },
  scheduledFor: string | null,
  cartId: string | null,
) {
  return {
    cart_id: cartId,
    timing: body.timing,
    scheduled_for: scheduledFor,
    delivery_method: body.deliveryMethod,
    payment_method: body.paymentMethod,
    needs_change:
      body.paymentMethod === 'cash' ? Boolean(body.needsChange) : false,
    change_for_amount_cents:
      body.paymentMethod === 'cash' && body.needsChange
        ? body.changeForAmountCents
        : null,
    customer_note: body.customerNote ?? null,
    delivery_fee_cents: delivery.deliveryFeeCents,
    route_distance_meters: delivery.routeDistanceMeters,
    address:
      body.deliveryMethod === 'delivery' && delivery.address
        ? {
            street: delivery.address.street,
            number: delivery.address.number,
            neighborhood: delivery.address.neighborhood,
            city: delivery.address.city,
            state: delivery.address.state,
            postal_code: delivery.address.postalCode ?? null,
            complement: delivery.address.complement ?? null,
            reference_point: delivery.address.referencePoint ?? null,
            latitude: delivery.address.latitude,
            longitude: delivery.address.longitude,
          }
        : null,
    items: body.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      customer_note: item.customerNote ?? null,
      add_ons: item.addOns.map((addon) => ({
        add_on_id: addon.addOnId,
        quantity: addon.quantity,
      })),
    })),
  };
}

async function fetchOrderSummary(
  orderId: string,
): Promise<Result<CreatedOrderSummary>> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('orders')
    .select(
      'id, order_number, status, total_cents, delivery_fee_cents, subtotal_cents, add_ons_total_cents',
    )
    .eq('id', orderId)
    .maybeSingle();

  if (error || !data) {
    return err(
      'INTERNAL_ERROR',
      'Pedido criado, mas falhou ao carregar resumo.',
      {
        cause: error,
      },
    );
  }

  const address = await admin
    .from('order_addresses')
    .select('route_distance_meters')
    .eq('order_id', orderId)
    .maybeSingle();

  return ok({
    id: data.id,
    orderNumber: data.order_number,
    status: data.status,
    totalCents: data.total_cents,
    deliveryFeeCents: data.delivery_fee_cents,
    subtotalCents: data.subtotal_cents + data.add_ons_total_cents,
    routeDistanceMeters: address.data?.route_distance_meters ?? null,
  });
}

async function invokeCreateOrder(
  rpcPayload: Record<string, unknown>,
): Promise<Result<string>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('create_order', {
    payload: rpcPayload as never,
  });

  if (error || !data) {
    logger.error('create_order falhou', { message: error?.message });
    return {
      ok: false,
      error: mapRpcError(error?.message ?? 'Falha ao criar pedido'),
    };
  }
  return ok(data);
}

export async function createOrderFromCheckout(options: {
  body: CreateOrderBody;
  idempotencyKey: string;
}): Promise<
  Result<{
    order: CreatedOrderSummary;
    pix?: CreatedOrderPix;
    replayed: boolean;
    httpStatus: number;
  }>
> {
  const identityResult = await resolveCustomerForCheckout();
  if (!identityResult.ok) return identityResult;

  const ensured = await ensureCustomerRecord(identityResult.data);
  if (!ensured.ok) return ensured;
  const identity = ensured.data;
  if (!hasCustomerName(identity.name)) {
    return err('VALIDATION_ERROR', 'Informe seu nome para concluir o pedido.');
  }

  const schedule = await validateScheduling(options.body);
  if (!schedule.ok) return schedule;

  const payment = await validatePaymentMethod(options.body);
  if (!payment.ok) return payment;

  const delivery = await resolveDeliveryFee(options.body);
  if (!delivery.ok) return delivery;

  if (
    options.body.paymentMethod === 'cash' &&
    options.body.needsChange &&
    (options.body.changeForAmountCents == null ||
      options.body.changeForAmountCents <= 0)
  ) {
    return err('VALIDATION_ERROR', 'Informe o valor para troco.');
  }

  const cartId = await getCustomerCartId(identity.id);
  const rpcPayload = toRpcPayload(
    options.body,
    delivery.data,
    schedule.data.scheduledFor,
    cartId,
  );
  const requestHash = hashIdempotencyPayload({
    customerId: identity.id,
    payload: rpcPayload,
  });

  const existing = await findIdempotentResponse({
    scope: 'create_order',
    key: options.idempotencyKey,
  });
  if (!existing.ok) return existing;

  if (existing.data) {
    if (existing.data.requestHash !== requestHash) {
      return err(
        'VALIDATION_ERROR',
        'Idempotency-Key já usada com outro payload.',
      );
    }
    const storedBody = existing.data.responseBody as {
      order: CreatedOrderSummary;
      pix?: CreatedOrderPix;
    };
    return ok({
      order: storedBody.order,
      pix: storedBody.pix,
      replayed: true,
      httpStatus: existing.data.responseStatus,
    });
  }

  const created = await invokeCreateOrder(rpcPayload);
  if (!created.ok) return created;

  const summary = await fetchOrderSummary(created.data);
  if (!summary.ok) return summary;

  let pix: CreatedOrderPix | undefined;
  if (options.body.paymentMethod === 'pix') {
    const charge = await createOrderPixCharge({
      orderId: summary.data.id,
      orderNumber: summary.data.orderNumber,
      totalCents: summary.data.totalCents,
      customer: { id: identity.id },
    });
    if (!charge.ok) {
      // Sem cobrança não há como pagar: cancela o pedido recém-criado.
      const admin = createAdminSupabaseClient();
      await admin.rpc('fail_order_pix_payment', {
        p_order_id: summary.data.id,
        p_reason: 'Falha ao gerar a cobrança Pix',
      });
      return charge;
    }
    pix = charge.data;
  }

  const cleared = await clearCustomerCart(identity.id);
  if (!cleared.ok) {
    logger.error('Pedido criado sem limpar carrinho persistido', {
      orderId: summary.data.id,
    });
  }

  const responseBody = { order: summary.data, ...(pix ? { pix } : {}) };
  const saved = await saveIdempotentResponse({
    scope: 'create_order',
    key: options.idempotencyKey,
    customerId: identity.id,
    requestHash,
    responseStatus: 201,
    responseBody,
  });
  if (!saved.ok) {
    // Pedido já criado; ainda retorna sucesso.
    logger.error('Pedido criado sem gravar idempotência', {
      orderId: summary.data.id,
    });
  }

  return ok({
    order: summary.data,
    pix,
    replayed: false,
    httpStatus: 201,
  });
}

export async function previewCheckout(body: CreateOrderBody): Promise<
  Result<{
    subtotalCents: number;
    deliveryFeeCents: number;
    totalCents: number;
    routeDistanceMeters: number | null;
    storeOpen: boolean;
  }>
> {
  const storeResult = await getPublicStore();
  if (!storeResult.ok) return storeResult;
  if (!storeResult.data) return err('NOT_FOUND', 'Loja não encontrada.');

  const schedule = await validateScheduling(body);
  if (!schedule.ok) return schedule;

  const delivery = await resolveDeliveryFee(body);
  if (!delivery.ok) return delivery;

  const admin = createAdminSupabaseClient();
  let subtotalCents = 0;

  for (const item of body.items) {
    const { data: product, error } = await admin
      .from('products')
      .select('id, price_cents, is_available, is_active, archived_at')
      .eq('id', item.productId)
      .maybeSingle();

    if (error || !product || product.archived_at || !product.is_active) {
      return err('PRODUCT_UNAVAILABLE', 'Produto indisponível no preview.');
    }
    if (!product.is_available) {
      return err('PRODUCT_UNAVAILABLE', 'Produto indisponível no momento.');
    }

    let line = product.price_cents * item.quantity;
    for (const addon of item.addOns) {
      const { data: addOnRow, error: addOnError } = await admin
        .from('add_ons')
        .select('id, price_cents, is_available, is_active, archived_at')
        .eq('id', addon.addOnId)
        .maybeSingle();
      if (
        addOnError ||
        !addOnRow ||
        addOnRow.archived_at ||
        !addOnRow.is_active ||
        !addOnRow.is_available
      ) {
        return err('PRODUCT_UNAVAILABLE', 'Adicional indisponível no preview.');
      }
      line += addOnRow.price_cents * addon.quantity * item.quantity;
    }
    subtotalCents += line;
  }

  return ok({
    subtotalCents,
    deliveryFeeCents: delivery.data.deliveryFeeCents,
    totalCents: subtotalCents + delivery.data.deliveryFeeCents,
    routeDistanceMeters: delivery.data.routeDistanceMeters,
    storeOpen: canPlaceImmediateOrder(storeResult.data),
  });
}
