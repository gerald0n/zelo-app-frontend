import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createPublicSupabaseClient } from '@/lib/supabase/public';
import { hasSupabasePublicConfig } from '@/config/env';
import {
  mapProduct,
  mapSatelliteLocation,
} from '@/modules/catalog/mappers';
import { listProductRatings } from '@/modules/catalog/product-ratings';
import type { CatalogProduct, SatelliteLocation } from '@/modules/catalog/types';

const PRODUCT_SELECT = `
  *,
  product_images (*),
  product_add_ons (
    sort_order,
    add_ons (*)
  )
`;

function notConfigured<T>(): Result<T> {
  return err(
    'INTEGRATION_UNAVAILABLE',
    'Catálogo indisponível: configure o Supabase no ambiente.',
  );
}

/**
 * Local satélite (ex.: São Miguel/RN) por slug — mirror de `getPublicStore()`,
 * junta as horas da semana + a lista fixa de slots de entrega.
 */
export async function getSatelliteLocation(
  slug = 'sao-miguel',
): Promise<Result<SatelliteLocation | null>> {
  if (!hasSupabasePublicConfig()) return notConfigured();

  try {
    const supabase = createPublicSupabaseClient();
    const { data: location, error: locationError } = await supabase
      .from('satellite_locations')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (locationError) {
      logger.error('Falha ao ler local satélite', {
        message: locationError.message,
      });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar a unidade.',
        { cause: locationError },
      );
    }

    if (!location) return ok(null);

    const [
      { data: hours, error: hoursError },
      { data: slots, error: slotsError },
    ] = await Promise.all([
      supabase
        .from('satellite_location_hours')
        .select('*')
        .eq('location_id', location.id)
        .order('weekday', { ascending: true }),
      supabase
        .from('satellite_location_delivery_slots')
        .select('*')
        .eq('location_id', location.id)
        .order('weekday', { ascending: true })
        .order('sort_order', { ascending: true }),
    ]);

    if (hoursError) {
      logger.error('Falha ao ler horários do local satélite', {
        message: hoursError.message,
      });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar os horários da unidade.',
        { cause: hoursError },
      );
    }

    if (slotsError) {
      logger.error('Falha ao ler slots de entrega do local satélite', {
        message: slotsError.message,
      });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar os horários de entrega da unidade.',
        { cause: slotsError },
      );
    }

    return ok(mapSatelliteLocation(location, hours ?? [], slots ?? []));
  } catch (cause) {
    logger.error('Erro inesperado ao ler local satélite', {});
    return err('INTERNAL_ERROR', 'Erro ao carregar a unidade.', { cause });
  }
}

/**
 * Produtos curados de "pronta entrega" de um local satélite — mirror de
 * `listPublicProducts()`, mas filtrado por `fulfillment_location_id` em vez
 * de excluí-lo. Estoque/disponibilidade seguem o mesmo mecanismo do catálogo
 * normal (`products.stock_quantity`/`is_available`).
 */
export async function listSatelliteProducts(
  locationId: string,
): Promise<Result<CatalogProduct[]>> {
  if (!hasSupabasePublicConfig()) return notConfigured();

  try {
    const supabase = createPublicSupabaseClient();
    // Produtos de pronta entrega são um lote curado e à parte — sem
    // promoções do catálogo normal, que valem por categoria/produto de
    // Pereiro.
    const [{ data, error }, ratings] = await Promise.all([
      supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('is_active', true)
        .is('archived_at', null)
        .eq('fulfillment_location_id', locationId)
        .order('sort_order', { ascending: true }),
      listProductRatings(supabase),
    ]);

    if (error) {
      logger.error('Falha ao ler produtos do local satélite', {
        message: error.message,
      });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar a pronta entrega.',
        { cause: error },
      );
    }

    return ok(
      (data ?? []).map((row) =>
        mapProduct(row, [], ratings.get(row.id) ?? null),
      ),
    );
  } catch (cause) {
    return err('INTERNAL_ERROR', 'Erro ao carregar a pronta entrega.', {
      cause,
    });
  }
}

/**
 * Todos os produtos de pronta entrega, de qualquer local satélite — usado só
 * para revalidar/hidratar o carrinho salvo no servidor (que não guarda em
 * qual local o cliente estava), que senão trataria esses itens como removidos
 * do catálogo por não aparecerem em `listPublicProducts()`.
 */
export async function listAllSatelliteProducts(): Promise<
  Result<CatalogProduct[]>
> {
  if (!hasSupabasePublicConfig()) return notConfigured();

  try {
    const supabase = createPublicSupabaseClient();
    const [{ data, error }, ratings] = await Promise.all([
      supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('is_active', true)
        .is('archived_at', null)
        .not('fulfillment_location_id', 'is', null)
        .order('sort_order', { ascending: true }),
      listProductRatings(supabase),
    ]);

    if (error) {
      logger.error('Falha ao ler produtos de pronta entrega', {
        message: error.message,
      });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar a pronta entrega.',
        { cause: error },
      );
    }

    return ok(
      (data ?? []).map((row) =>
        mapProduct(row, [], ratings.get(row.id) ?? null),
      ),
    );
  } catch (cause) {
    return err('INTERNAL_ERROR', 'Erro ao carregar a pronta entrega.', {
      cause,
    });
  }
}
