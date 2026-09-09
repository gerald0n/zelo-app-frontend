import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { PublicTestimonial } from '@/modules/reviews/types';

/**
 * Depoimentos da vitrine: só os aprovados + em destaque (a RLS já filtra).
 * Usado na home e na página da loja.
 */
export async function listPublicTestimonials(
  limit = 12,
): Promise<Result<PublicTestimonial[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('order_reviews')
    .select('id, rating, comment, customer_display_name, moderated_at, created_at')
    .eq('status', 'approved')
    .eq('is_featured', true)
    .not('comment', 'is', null)
    .order('moderated_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    logger.error('Falha ao carregar depoimentos', { message: error.message });
    return err('INTERNAL_ERROR', 'Não foi possível carregar os depoimentos.', {
      cause: error,
    });
  }

  const testimonials: PublicTestimonial[] = (data ?? [])
    .filter((row) => (row.comment ?? '').trim().length > 0)
    .map((row) => ({
      id: row.id,
      displayName: row.customer_display_name,
      rating: row.rating,
      comment: (row.comment ?? '').trim(),
      date: row.moderated_at ?? row.created_at,
    }));

  return ok(testimonials);
}
