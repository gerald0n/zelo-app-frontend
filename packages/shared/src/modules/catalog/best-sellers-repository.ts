import 'server-only';

import { hasSupabasePublicConfig } from '@/config/env';
import { logger } from '@/lib/logger';
import { createPublicSupabaseClient } from '@/lib/supabase/public';

/**
 * IDs dos produtos mais vendidos (por quantidade) nos últimos `days` dias,
 * do mais pro menos vendido. Usa a RPC `get_top_selling_products`
 * (security definer): `order_items`/`orders` têm dado de cliente e não têm
 * policy de leitura pública, então a agregação roda no banco e só o
 * resultado seguro (product_id + total) volta pro cliente. Falha em
 * silêncio — a seção de "mais vendidos" some, mas não derruba a home.
 */
export async function listPublicBestSellingProductIds(
  days: number,
  limit: number,
): Promise<string[]> {
  if (!hasSupabasePublicConfig()) return [];

  try {
    const supabase = createPublicSupabaseClient();
    const since = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data, error } = await supabase.rpc('get_top_selling_products', {
      p_since: since,
      p_limit: limit,
    });

    if (error) {
      logger.error('Falha ao ler mais vendidos', { message: error.message });
      return [];
    }

    return (data ?? []).map((row) => row.product_id);
  } catch {
    logger.error('Erro inesperado ao ler mais vendidos', {});
    return [];
  }
}
