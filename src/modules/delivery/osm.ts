import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { GeoPoint, GeocodeResult } from '@/modules/delivery/maps';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const USER_AGENT = 'ZeloConfeitaria/1.0 (https://zeloconfeitaria.com.br)';

/** Recorte urbano de Pereiro para viés de geocodificação (left, bottom, right, top). */
const PEREIRO_VIEWBOX = '-38.66,-6.03,-38.58,-5.93';

export async function geocodeAddressOsm(
  address: string,
): Promise<Result<GeocodeResult>> {
  try {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('q', address);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('countrycodes', 'br');
    url.searchParams.set('viewbox', PEREIRO_VIEWBOX);
    url.searchParams.set('bounded', '1');

    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Falha ao localizar o endereço no mapa.',
      );
    }

    const data = (await response.json()) as Array<{
      lat: string;
      lon: string;
      display_name?: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        postcode?: string;
      };
    }>;

    const result = data[0];
    if (!result) {
      return err('VALIDATION_ERROR', 'Não foi possível localizar o endereço.');
    }

    return ok({
      latitude: Number(result.lat),
      longitude: Number(result.lon),
      formattedAddress: result.display_name ?? address,
      city: result.address?.city ?? result.address?.town ?? result.address?.village,
      state: result.address?.state,
      postalCode: result.address?.postcode,
    });
  } catch (cause) {
    logger.captureAppError(
      {
        code: 'INTEGRATION_UNAVAILABLE',
        message: 'Erro ao geocodificar via OpenStreetMap',
        cause,
      },
      { integration: 'osm_nominatim' },
    );
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Serviço de mapas temporariamente indisponível.',
      { cause },
    );
  }
}

export async function getDrivingDistanceOsm(
  origin: GeoPoint,
  destination: GeoPoint,
): Promise<Result<number>> {
  try {
    const path = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const url = `${OSRM_URL}/${path}?overview=false&alternatives=false`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Falha ao calcular a rota de entrega.',
      );
    }

    const data = (await response.json()) as {
      code?: string;
      routes?: Array<{ distance?: number }>;
    };
    const distance = data.routes?.[0]?.distance;
    if (data.code !== 'Ok' || distance == null) {
      return err(
        'VALIDATION_ERROR',
        'Não foi possível calcular a rota até o endereço.',
      );
    }

    return ok(Math.round(distance));
  } catch (cause) {
    logger.captureAppError(
      {
        code: 'INTEGRATION_UNAVAILABLE',
        message: 'Erro ao calcular rota via OSRM',
        cause,
      },
      { integration: 'osm_osrm' },
    );
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Serviço de rota temporariamente indisponível.',
      { cause },
    );
  }
}
