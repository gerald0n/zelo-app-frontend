import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createPublicSupabaseClient } from '@/lib/supabase/public';
import { hasSupabasePublicConfig } from '@/config/env';
import { mapStore } from '@/modules/catalog/mappers';
import type { CatalogStore } from '@/modules/catalog/types';

function notConfigured<T>(): Result<T> {
  return err(
    'INTEGRATION_UNAVAILABLE',
    'Catálogo indisponível: configure o Supabase no ambiente.',
  );
}

/**
 * `storeId` (ADR-0001, Fase C): quando informado, busca aquele tenant
 * específico em vez do fallback de loja única. Opcional e com o
 * comportamento antigo preservado para não quebrar chamadores que ainda não
 * foram migrados — a migração é incremental, não um corte único.
 */
export async function getPublicStore(
  storeId?: string,
): Promise<Result<CatalogStore | null>> {
  if (!hasSupabasePublicConfig()) return notConfigured();

  try {
    const supabase = createPublicSupabaseClient();
    const storeQuery = storeId
      ? supabase.from('stores').select('*').eq('id', storeId).maybeSingle()
      : supabase
          .from('stores')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
    const { data: store, error: storeError } = await storeQuery;

    if (storeError) {
      logger.error('Falha ao ler loja', { message: storeError.message });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar a loja.',
        {
          cause: storeError,
        },
      );
    }

    if (!store) return ok(null);

    const [
      { data: hours, error: hoursError },
      { data: blackouts, error: blackoutsError },
    ] = await Promise.all([
      supabase
        .from('store_business_hours')
        .select('*')
        .eq('store_id', store.id)
        .order('weekday', { ascending: true }),
      supabase
        .from('store_blackout_periods')
        .select('id, starts_at, ends_at, reason')
        .eq('store_id', store.id)
        .order('starts_at', { ascending: true }),
    ]);

    if (hoursError) {
      logger.error('Falha ao ler horários', { message: hoursError.message });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar os horários.',
        { cause: hoursError },
      );
    }

    if (blackoutsError) {
      logger.error('Falha ao ler bloqueios', {
        message: blackoutsError.message,
      });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar os períodos bloqueados.',
        { cause: blackoutsError },
      );
    }

    return ok(mapStore(store, hours ?? [], blackouts ?? []));
  } catch (cause) {
    logger.error('Erro inesperado ao ler loja', {});
    return err('INTERNAL_ERROR', 'Erro ao carregar a loja.', { cause });
  }
}
