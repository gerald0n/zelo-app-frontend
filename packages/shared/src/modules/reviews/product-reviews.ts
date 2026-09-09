import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createCustomerIdentityProvider } from '@/modules/auth/customer-identity';
import {
  ensureCustomerRecord,
  resolveCustomerForCheckout,
} from '@/modules/orders/customer';
import {
  buildReviewDisplayName,
  REVIEW_COMMENT_MAX,
  type CustomerProductReview,
  type ProductRatingSummary,
  type ProductReviewsView,
  type PublicProductReview,
} from '@/modules/reviews/types';

type RatingRow = { product_id: string; rating: number };

function summarize(ratings: number[]): ProductRatingSummary {
  if (ratings.length === 0) return { average: 0, count: 0 };
  const total = ratings.reduce((sum, value) => sum + value, 0);
  return {
    average: Math.round((total / ratings.length) * 10) / 10,
    count: ratings.length,
  };
}

/**
 * Média + volume de avaliações aprovadas por produto. Usado pelo catálogo
 * (cards e página do produto). Uma consulta enxuta; a agregação é em JS.
 */
export async function getProductRatingSummaries(
  productIds?: string[],
): Promise<Map<string, ProductRatingSummary>> {
  const admin = createAdminSupabaseClient();
  let query = admin
    .from('product_reviews')
    .select('product_id, rating')
    .eq('status', 'approved');
  if (productIds && productIds.length > 0) {
    query = query.in('product_id', productIds);
  }

  const { data, error } = await query;
  if (error) {
    logger.warn('Falha ao carregar médias de avaliação', {
      message: error.message,
    });
    return new Map();
  }

  const byProduct = new Map<string, number[]>();
  for (const row of (data ?? []) as RatingRow[]) {
    const list = byProduct.get(row.product_id) ?? [];
    list.push(row.rating);
    byProduct.set(row.product_id, list);
  }

  const result = new Map<string, ProductRatingSummary>();
  for (const [productId, ratings] of byProduct) {
    result.set(productId, summarize(ratings));
  }
  return result;
}

/** Encontra um pedido entregue deste cliente que continha o produto. */
async function findDeliveredOrderWithProduct(
  customerId: string,
  productId: string,
): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('order_items')
    .select('order_id, orders!inner(customer_id, status)')
    .eq('product_id', productId)
    .eq('orders.customer_id', customerId)
    .eq('orders.status', 'delivered')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    logger.warn('Falha ao checar elegibilidade de avaliação', {
      message: error.message,
    });
    return null;
  }
  return data && data.length > 0 ? data[0].order_id : null;
}

async function currentCustomerId(): Promise<string | null> {
  const provider = createCustomerIdentityProvider();
  const identity = await provider.getCurrent();
  return identity.ok && identity.data ? identity.data.id : null;
}

/**
 * Tudo o que a seção "Avaliações" da página do produto precisa: resumo, as
 * avaliações aprovadas e o contexto do cliente logado (pode avaliar? já
 * avaliou?). Sem sessão, `canReview` é `false` e `myReview` é `null`.
 */
export async function getProductReviewsView(
  productId: string,
): Promise<Result<ProductReviewsView>> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('product_reviews')
    .select('id, rating, comment, status, customer_display_name, created_at')
    .eq('product_id', productId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar as avaliações.', {
      cause: error,
    });
  }

  const items: PublicProductReview[] = (data ?? []).map((row) => ({
    id: row.id,
    displayName: row.customer_display_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  }));
  const summary = summarize(items.map((item) => item.rating));

  const customerId = await currentCustomerId();
  if (!customerId) {
    return ok({ summary, items, canReview: false, myReview: null });
  }

  const existing = await admin
    .from('product_reviews')
    .select('rating, comment, status, created_at')
    .eq('product_id', productId)
    .eq('customer_id', customerId)
    .maybeSingle();

  const myReview: CustomerProductReview | null = existing.data
    ? {
        rating: existing.data.rating,
        comment: existing.data.comment,
        status: existing.data.status,
        createdAt: existing.data.created_at,
      }
    : null;

  const canReview = myReview
    ? false
    : (await findDeliveredOrderWithProduct(customerId, productId)) !== null;

  return ok({ summary, items, canReview, myReview });
}

export type SubmitProductReviewInput = {
  productId: string;
  rating: number;
  comment?: string | null;
};

/**
 * Cliente avalia um produto. Só quem tem um pedido entregue contendo o item;
 * uma avaliação por cliente por produto; entra como `pending` até o admin
 * aprovar.
 */
export async function submitProductReview(
  input: SubmitProductReviewInput,
): Promise<Result<CustomerProductReview>> {
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

  const orderId = await findDeliveredOrderWithProduct(
    identity.data.id,
    input.productId,
  );
  if (!orderId) {
    return err(
      'REVIEW_NOT_ALLOWED',
      'Você poderá avaliar depois de receber um pedido com este item.',
    );
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('product_reviews')
    .insert({
      product_id: input.productId,
      customer_id: identity.data.id,
      order_id: orderId,
      rating,
      comment,
      customer_display_name: buildReviewDisplayName(identity.data.name),
    })
    .select('rating, comment, status, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return err('REVIEW_NOT_ALLOWED', 'Você já avaliou este produto.');
    }
    logger.error('Falha ao salvar avaliação de produto', {
      message: error.message,
    });
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
