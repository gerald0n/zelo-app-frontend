import 'server-only';

import { hasSupabasePublicConfig } from '@/config/env';
import { err, ok, type Result } from '@/lib/errors';
import { bannerImagePublicUrl } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { createPublicSupabaseClient } from '@/lib/supabase/public';
import type { CatalogPromoModalBanner } from '@/modules/catalog/types';

function notConfigured<T>(): Result<T> {
  return err(
    'INTEGRATION_UNAVAILABLE',
    'Catálogo indisponível: configure o Supabase no ambiente.',
  );
}

/**
 * Campanhas ativas do banner modal (popup 1x por sessão) — a policy
 * `promo_modal_banners_public_read` já filtra `is_active`/janela de
 * vigência pra `anon`, então um `select` simples basta. Só retorna campanhas
 * com as duas imagens já enviadas (mesma regra de `not storage_path eq ''`
 * usada em `getPublicBanners`).
 */
export async function getPublicPromoModalBanners(
  storeId?: string,
): Promise<Result<CatalogPromoModalBanner[]>> {
  if (!hasSupabasePublicConfig()) return notConfigured();

  try {
    const supabase = createPublicSupabaseClient();
    let query = supabase
      .from('promo_modal_banners')
      .select(
        'id, title, link_href, storage_path_vertical, storage_path_horizontal',
      )
      .not('storage_path_vertical', 'eq', '')
      .not('storage_path_horizontal', 'eq', '')
      .order('sort_order', { ascending: true });
    if (storeId) query = query.eq('store_id', storeId);
    const { data, error } = await query;

    if (error) {
      logger.error('Falha ao ler banners do modal', { message: error.message });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar o banner de campanha.',
        { cause: error },
      );
    }

    return ok(
      (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        linkHref: row.link_href,
        imageUrlVertical: bannerImagePublicUrl(row.storage_path_vertical, {
          width: 941,
        }),
        imageUrlHorizontal: bannerImagePublicUrl(row.storage_path_horizontal, {
          width: 1672,
        }),
      })),
    );
  } catch (cause) {
    logger.error('Falha ao ler banners do modal', {
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Não foi possível carregar o banner de campanha.',
      { cause },
    );
  }
}
