import 'server-only';

import { hasSupabasePublicConfig } from '@/config/env';
import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createPublicSupabaseClient } from '@/lib/supabase/public';
import type { CatalogFaqItem } from '@/modules/catalog/types';

function notConfigured<T>(): Result<T> {
  return err(
    'INTEGRATION_UNAVAILABLE',
    'Catálogo indisponível: configure o Supabase no ambiente.',
  );
}

/**
 * Perguntas frequentes ativas do popover de ajuda — a policy
 * `faq_items_public_read` já filtra `is_active` pra `anon`, então um
 * `select` simples basta (mesmo padrão de `getPublicBanners`).
 */
export async function getPublicFaqItems(
  storeId?: string,
): Promise<Result<CatalogFaqItem[]>> {
  if (!hasSupabasePublicConfig()) return notConfigured();

  try {
    const supabase = createPublicSupabaseClient();
    let query = supabase
      .from('faq_items')
      .select('id, question, answer')
      .order('sort_order', { ascending: true });
    if (storeId) query = query.eq('store_id', storeId);
    const { data, error } = await query;

    if (error) {
      logger.error('Falha ao ler FAQ', { message: error.message });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar as perguntas frequentes.',
        { cause: error },
      );
    }

    return ok(
      (data ?? []).map((row) => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
      })),
    );
  } catch (cause) {
    logger.error('Falha ao ler FAQ', {
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Não foi possível carregar as perguntas frequentes.',
      { cause },
    );
  }
}
