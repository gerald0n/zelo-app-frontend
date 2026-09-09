import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import type { Database } from '@/types/database';

export type ProductRating = { average: number; count: number };

/**
 * Média + volume de avaliações aprovadas por produto. A policy
 * `product_reviews_public_read` já limita a `status = 'approved'`, então um
 * `select` simples basta. Falha em silêncio: avaliação fora do ar não pode
 * derrubar o cardápio.
 */
export async function listProductRatings(
  supabase: SupabaseClient<Database>,
): Promise<Map<string, ProductRating>> {
  const { data, error } = await supabase
    .from('product_reviews')
    .select('product_id, rating')
    .eq('status', 'approved');

  if (error) {
    logger.error('Falha ao ler avaliações de produto', {
      message: error.message,
    });
    return new Map();
  }

  const byProduct = new Map<string, number[]>();
  for (const row of data ?? []) {
    const list = byProduct.get(row.product_id) ?? [];
    list.push(row.rating);
    byProduct.set(row.product_id, list);
  }

  const result = new Map<string, ProductRating>();
  for (const [productId, ratings] of byProduct) {
    const total = ratings.reduce((sum, value) => sum + value, 0);
    result.set(productId, {
      average: Math.round((total / ratings.length) * 10) / 10,
      count: ratings.length,
    });
  }
  return result;
}
