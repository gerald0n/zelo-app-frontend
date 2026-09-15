import 'server-only';

import { hasSupabasePublicConfig } from '@/config/env';
import { err, ok, type Result } from '@/lib/errors';
import { bannerImagePublicUrl } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { createPublicSupabaseClient } from '@/lib/supabase/public';
import type { CatalogBanner } from '@/modules/catalog/types';

function notConfigured<T>(): Result<T> {
  return err(
    'INTEGRATION_UNAVAILABLE',
    'Catálogo indisponível: configure o Supabase no ambiente.',
  );
}

/**
 * Banners ativos do carrossel da home — a policy `promo_banners_public_read`
 * já filtra `is_active`/janela de vigência pra `anon`, então um `select`
 * simples basta (mesmo padrão de `listActivePromotions` em
 * `catalog-repository.ts`).
 */
export async function getPublicBanners(): Promise<Result<CatalogBanner[]>> {
  if (!hasSupabasePublicConfig()) return notConfigured();

  try {
    const supabase = createPublicSupabaseClient();
    const { data, error } = await supabase
      .from('promo_banners')
      .select('id, title, subtitle, link_href, storage_path')
      .not('storage_path', 'eq', '')
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('Falha ao ler banners', { message: error.message });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar os banners.',
        { cause: error },
      );
    }

    return ok(
      (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: row.subtitle,
        linkHref: row.link_href,
        imageUrl: bannerImagePublicUrl(row.storage_path, { width: 1200 }),
      })),
    );
  } catch (cause) {
    logger.error('Falha ao ler banners', {
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Não foi possível carregar os banners.',
      { cause },
    );
  }
}
