import 'server-only';

import { unstable_cache } from 'next/cache';
import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createPublicSupabaseClient } from '@/lib/supabase/public';
import {
  TESTIMONIALS_CACHE_TAG,
  TESTIMONIALS_CACHE_TTL_SECONDS,
} from '@/modules/catalog/cache';
import type { PublicTestimonial } from '@/modules/reviews/types';

async function fetchTestimonials(limit: number): Promise<PublicTestimonial[]> {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase
    .from('order_reviews')
    .select('id, rating, comment, customer_display_name, moderated_at, created_at')
    .eq('status', 'approved')
    .eq('is_featured', true)
    .not('comment', 'is', null)
    .order('moderated_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw new Error(`order_reviews: ${error.message}`);

  return (data ?? [])
    .filter((row) => (row.comment ?? '').trim().length > 0)
    .map((row) => ({
      id: row.id,
      displayName: row.customer_display_name,
      rating: row.rating,
      comment: (row.comment ?? '').trim(),
      date: row.moderated_at ?? row.created_at,
    }));
}

const cachedTestimonials = unstable_cache(fetchTestimonials, ['testimonials'], {
  tags: [TESTIMONIALS_CACHE_TAG],
  revalidate: TESTIMONIALS_CACHE_TTL_SECONDS,
});

/**
 * Depoimentos da vitrine: só os aprovados + em destaque (a RLS já filtra).
 * Usado na home e na página da loja — servido do Data Cache do Next.
 */
export async function listPublicTestimonials(
  limit = 12,
): Promise<Result<PublicTestimonial[]>> {
  try {
    return ok(await cachedTestimonials(limit));
  } catch (cause) {
    logger.error('Falha ao carregar depoimentos', {
      message: cause instanceof Error ? cause.message : 'erro desconhecido',
    });
    return err('INTERNAL_ERROR', 'Não foi possível carregar os depoimentos.', {
      cause,
    });
  }
}
