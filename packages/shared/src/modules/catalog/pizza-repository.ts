import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createPublicSupabaseClient } from '@/lib/supabase/public';
import { hasSupabasePublicConfig } from '@/config/env';
import { mapPizzaAddon, mapPizzaSize } from '@/modules/catalog/mappers';
import type { CatalogPizzaAddon, CatalogPizzaSize } from '@/modules/catalog/types';

function notConfigured<T>(): Result<T> {
  return err(
    'INTEGRATION_UNAVAILABLE',
    'Catálogo indisponível: configure o Supabase no ambiente.',
  );
}

export async function listPublicPizzaSizes(): Promise<
  Result<CatalogPizzaSize[]>
> {
  if (!hasSupabasePublicConfig()) return notConfigured();

  try {
    const supabase = createPublicSupabaseClient();
    const { data, error } = await supabase
      .from('pizza_sizes')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('Falha ao ler tamanhos de pizza', {
        message: error.message,
      });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar os tamanhos de pizza.',
        { cause: error },
      );
    }

    return ok((data ?? []).map(mapPizzaSize));
  } catch (cause) {
    return err('INTERNAL_ERROR', 'Erro ao carregar tamanhos de pizza.', {
      cause,
    });
  }
}

export async function listPublicPizzaAddons(): Promise<
  Result<CatalogPizzaAddon[]>
> {
  if (!hasSupabasePublicConfig()) return notConfigured();

  try {
    const supabase = createPublicSupabaseClient();
    const { data, error } = await supabase
      .from('pizza_addons')
      .select('*')
      .eq('is_active', true)
      .is('archived_at', null)
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('Falha ao ler adicionais de pizza', {
        message: error.message,
      });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar os adicionais de pizza.',
        { cause: error },
      );
    }

    return ok((data ?? []).map(mapPizzaAddon));
  } catch (cause) {
    return err('INTERNAL_ERROR', 'Erro ao carregar adicionais de pizza.', {
      cause,
    });
  }
}
