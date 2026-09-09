import 'server-only';

import { logger } from '@/lib/logger';
import { getCatalogRevalidateSecret, getClientAppOrigin } from '@/config/env';
import type { CatalogRevalidateTag } from '@/modules/catalog/cache';

/** Rota no `apps/client` que executa o `revalidateTag`. */
export const CATALOG_REVALIDATE_PATH = '/api/v1/internal/revalidate';

/**
 * Tags a invalidar para uma ação de auditoria do painel. `store.*` mexe na
 * loja/horários; `product.*` / `category.*` / `addon.*` / `promotion.*` mexem
 * no cardápio (a promoção altera preços em `mapProduct`).
 */
export function catalogTagsForAuditAction(
  action: string,
): CatalogRevalidateTag[] {
  if (action.startsWith('store.')) return ['store'];
  if (
    action.startsWith('product.') ||
    action.startsWith('category.') ||
    action.startsWith('addon.') ||
    action.startsWith('promotion.')
  ) {
    return ['catalog'];
  }
  return [];
}

/**
 * Pede ao `apps/client` (deploy separado, Data Cache próprio) que limpe as
 * tags informadas. Fire-and-forget: erro aqui NUNCA derruba a mutation do
 * painel — o TTL do cache ainda cobre a propagação.
 */
export async function requestCatalogRevalidation(
  tags: CatalogRevalidateTag[],
): Promise<void> {
  if (tags.length === 0) return;

  const origin = getClientAppOrigin();
  const secret = getCatalogRevalidateSecret();
  if (!origin || !secret) {
    logger.warn('Revalidação do catálogo não configurada; usando só o TTL', {
      tags,
    });
    return;
  }

  try {
    const response = await fetch(`${origin}${CATALOG_REVALIDATE_PATH}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ tags }),
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      logger.error('Revalidação do catálogo falhou', {
        status: response.status,
        tags,
      });
    }
  } catch (cause) {
    logger.error('Revalidação do catálogo: erro de rede', {
      message: cause instanceof Error ? cause.message : 'erro desconhecido',
      tags,
    });
  }
}
