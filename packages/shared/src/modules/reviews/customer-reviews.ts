import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import {
  ensureCustomerRecord,
  resolveCustomerForCheckout,
} from '@/modules/orders/customer';
import { getCustomerOrder } from '@/modules/orders/customer-orders';
import {
  buildReviewDisplayName,
  REVIEW_COMMENT_MAX,
  type CustomerOrderReview,
} from '@/modules/reviews/types';

export type SubmitOrderReviewInput = {
  orderId: string;
  rating: number;
  comment?: string | null;
  productRatings?: Array<{ productId: string; rating: number }>;
};

/**
 * Cria/atualiza a avaliação por produto pra cada item do pedido, a partir da
 * avaliação do pedido que acabou de ser salva. Best-effort: erro aqui não
 * derruba a avaliação do pedido, que já foi persistida.
 */
async function fanOutProductReviews(input: {
  orderId: string;
  customerId: string;
  customerName: string;
  comment: string | null;
  orderProductIds: Set<string>;
  productRatings: Array<{ productId: string; rating: number }>;
}): Promise<void> {
  const rows = input.productRatings
    .filter(
      (item) =>
        input.orderProductIds.has(item.productId) &&
        Number.isInteger(item.rating) &&
        item.rating >= 1 &&
        item.rating <= 5,
    )
    .map((item) => ({
      product_id: item.productId,
      customer_id: input.customerId,
      order_id: input.orderId,
      rating: item.rating,
      comment: input.comment,
      customer_display_name: buildReviewDisplayName(input.customerName),
    }));

  if (rows.length === 0) return;

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from('product_reviews')
    .upsert(rows, { onConflict: 'product_id,customer_id', ignoreDuplicates: true });

  if (error) {
    logger.warn('Falha ao propagar avaliação para os produtos do pedido', {
      orderId: input.orderId,
      message: error.message,
    });
  }
}

/**
 * Cliente avalia um pedido entregue. Uma avaliação por pedido; entra como
 * `pending` e só aparece no site depois que o admin aprova + destaca.
 */
export async function submitOrderReview(
  input: SubmitOrderReviewInput,
): Promise<Result<CustomerOrderReview>> {
  const rating = Math.trunc(input.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return err('VALIDATION_ERROR', 'A nota precisa ser de 1 a 5 estrelas.');
  }

  const comment = input.comment?.trim() ? input.comment.trim() : null;
  if (comment && comment.length > REVIEW_COMMENT_MAX) {
    return err(
      'VALIDATION_ERROR',
      `O comentário pode ter no máximo ${REVIEW_COMMENT_MAX} caracteres.`,
    );
  }

  const identity = await resolveCustomerForCheckout();
  if (!identity.ok) return identity;
  const ensured = await ensureCustomerRecord(identity.data);
  if (!ensured.ok) return ensured;

  // Confere posse do pedido e o status pela mesma fonte da tela de acompanhamento.
  const order = await getCustomerOrder(input.orderId);
  if (!order.ok) return order;
  if (order.data.status !== 'delivered') {
    return err(
      'REVIEW_NOT_ALLOWED',
      'Você poderá avaliar assim que o pedido for entregue.',
    );
  }
  if (order.data.review) {
    return err('REVIEW_NOT_ALLOWED', 'Este pedido já foi avaliado.');
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('order_reviews')
    .insert({
      order_id: input.orderId,
      customer_id: ensured.data.id,
      rating,
      comment,
      customer_display_name: buildReviewDisplayName(ensured.data.name),
    })
    .select('rating, comment, status, created_at')
    .single();

  if (error) {
    // Corrida: violação da unique = alguém avaliou entre a checagem e o insert.
    if (error.code === '23505') {
      return err('REVIEW_NOT_ALLOWED', 'Este pedido já foi avaliado.');
    }
    logger.error('Falha ao salvar avaliação', { message: error.message });
    return err('INTERNAL_ERROR', 'Não foi possível enviar sua avaliação.', {
      cause: error,
    });
  }

  const orderProductIds = new Set(
    order.data.items
      .map((item) => item.productId)
      .filter((id): id is string => id !== null),
  );
  const productRatings =
    input.productRatings && input.productRatings.length > 0
      ? input.productRatings
      : [...orderProductIds].map((productId) => ({ productId, rating }));

  await fanOutProductReviews({
    orderId: input.orderId,
    customerId: ensured.data.id,
    customerName: ensured.data.name,
    comment,
    orderProductIds,
    productRatings,
  });

  return ok({
    rating: data.rating,
    comment: data.comment,
    status: data.status,
    createdAt: data.created_at,
  });
}
