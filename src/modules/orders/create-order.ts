import 'server-only';

import { hasCustomerName } from '@/modules/auth/customer-name';
import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { getPublicStore } from '@/modules/catalog/catalog-repository';
import {
  clearCustomerCart,
  getCustomerCartId,
} from '@/modules/carts/persist-cart';
import { canPlaceImmediateOrder } from '@/modules/scheduling/schedule';
import {
  ensureCustomerRecord,
  findIdempotentResponse,
  hashIdempotencyPayload,
  resolveCustomerForCheckout,
  saveIdempotentResponse,
} from '@/modules/orders/customer';
import { createOrderPixCharge } from '@/modules/payments';
import {
  createOrderBodySchema,
  type CreateOrderBody,
  type CreatedOrderPix,
  type CreatedOrderSummary,
} from '@/modules/orders/create-order-schema';
import {
  resolveDeliveryFee,
  validatePaymentMethod,
  validateScheduling,
} from '@/modules/orders/create-order-validation';
import {
  fetchOrderSummary,
  invokeCreateOrder,
  toRpcPayload,
} from '@/modules/orders/create-order-rpc';

export {
  createOrderBodySchema,
  type CreateOrderBody,
  type CreatedOrderPix,
  type CreatedOrderSummary,
};

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
