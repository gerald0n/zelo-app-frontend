import 'server-only';

import { logger } from '@/lib/logger';
import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createCustomerIdentityProvider } from '@/modules/auth/customer-identity';
import {
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

async function currentCustomerId(): Promise<string | null> {
  const provider = createCustomerIdentityProvider();
  const identity = await provider.getCurrent();
  return identity.ok && identity.data ? identity.data.id : null;
}

/**
 * Tudo o que a seção "Avaliações" da página do produto precisa: resumo, as
 * avaliações aprovadas e a avaliação do cliente logado, se houver (enviada
 * junto com a avaliação do pedido). Sem sessão, `myReview` é `null`.
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
    return ok({ summary, items, myReview: null });
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

  return ok({ summary, items, myReview });
}
