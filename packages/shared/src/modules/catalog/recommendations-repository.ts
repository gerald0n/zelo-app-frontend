import 'server-only';

import { hasSupabasePublicConfig } from '@/config/env';
import { logger } from '@/lib/logger';
import { createPublicSupabaseClient } from '@/lib/supabase/public';

const RECOMMENDATION_WINDOW_DAYS = 90;
const RECOMMENDATION_MIN_PAIR_COUNT = 3;

/**
 * Produto mais comprado junto com `productId` nos últimos 90 dias, exigindo
 * ao menos 3 pedidos em comum (RPC `get_pair_recommendation`). `null` quando
 * não há par forte o bastante — não há fallback, a seção de recomendação
 * simplesmente não aparece. Mesmo padrão de `listPublicBestSellingProductIds`:
 * `order_items`/`orders` não têm policy de leitura pública, a agregação roda
 * no banco via RPC security definer e falha em silêncio.
 */
export async function getPairRecommendationProductId(
  productId: string,
): Promise<string | null> {
  if (!hasSupabasePublicConfig()) return null;

  try {
    const supabase = createPublicSupabaseClient();
    const since = new Date(
      Date.now() - RECOMMENDATION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data, error } = await supabase.rpc('get_pair_recommendation', {
      p_product_id: productId,
      p_since: since,
      p_min_count: RECOMMENDATION_MIN_PAIR_COUNT,
    });

    if (error) {
      logger.error('Falha ao ler recomendação do carrinho', {
        message: error.message,
      });
      return null;
    }

    return data ?? null;
  } catch {
    logger.error('Erro inesperado ao ler recomendação do carrinho', {});
    return null;
  }
}
