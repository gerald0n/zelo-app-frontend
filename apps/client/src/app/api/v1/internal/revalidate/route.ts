import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getCatalogRevalidateSecret } from '@/config/env';
import { logger } from '@/lib/logger';
import {
  REVALIDATABLE_CACHE_TAGS,
  type CatalogRevalidateTag,
} from '@/modules/catalog/cache';

export const dynamic = 'force-dynamic';

/**
 * Invalidação on-demand do Data Cache do catálogo. Chamada pelo `apps/admin`
 * (deploy separado) após editar catálogo/loja — ver
 * `@/modules/catalog/revalidate`. Autentica por `Authorization: Bearer
 * <CATALOG_REVALIDATE_SECRET>` (segredo compartilhado entre os dois apps).
 */

function safeEqual(header: string | null, expected: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isRevalidatableTag(value: unknown): value is CatalogRevalidateTag {
  return (
    typeof value === 'string' &&
    (REVALIDATABLE_CACHE_TAGS as readonly string[]).includes(value)
  );
}

export async function POST(request: Request) {
  const secret = getCatalogRevalidateSecret();
  if (!secret) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  if (!safeEqual(request.headers.get('authorization'), `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    tags?: unknown;
  } | null;
  const tags = Array.isArray(body?.tags)
    ? [...new Set(body.tags.filter(isRevalidatableTag))]
    : [];

  if (tags.length === 0) {
    return NextResponse.json({ error: 'no_valid_tags' }, { status: 400 });
  }

  for (const tag of tags) {
    // `{ expire: 0 }`: sem stale — a próxima visita já busca fresco.
    revalidateTag(tag, { expire: 0 });
  }

  logger.info('Cache do catálogo revalidado', { tags });
  return NextResponse.json({ revalidated: tags });
}
