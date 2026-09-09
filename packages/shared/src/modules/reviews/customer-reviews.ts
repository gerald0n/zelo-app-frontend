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
};

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

  return ok({
    rating: data.rating,
    comment: data.comment,
    status: data.status,
    createdAt: data.created_at,
  });
}
