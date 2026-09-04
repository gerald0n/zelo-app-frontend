import { getGoogleMapsApiKey } from '@/config/env';
import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

/**
 * Precisão do resultado, conforme a Geocoding API:
 * `ROOFTOP` (exata) > `RANGE_INTERPOLATED` (interpolada no trecho da rua) >
 * `GEOMETRIC_CENTER` (centro de um quarteirão/área) > `APPROXIMATE` (região).
 */
export type GeocodeLocationType =
  | 'ROOFTOP'
  | 'RANGE_INTERPOLATED'
  | 'GEOMETRIC_CENTER'
  | 'APPROXIMATE';

export type GeocodeResult = GeoPoint & {
  formattedAddress: string;
  city?: string;
  state?: string;
  postalCode?: string;
  locationType?: GeocodeLocationType;
};

export function hasGoogleMapsServerKey(): boolean {
  return Boolean(getGoogleMapsApiKey());
}

/** Descreve um erro incluindo a `cause` aninhada do undici ("fetch failed"). */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const inner = (error as { cause?: unknown }).cause;
  if (inner instanceof Error) {
    return `${error.name}: ${error.message} <- ${inner.name}: ${inner.message}`;
  }
  if (inner != null) return `${error.name}: ${error.message} <- ${String(inner)}`;
  return `${error.name}: ${error.message}`;
}

export type GeocodeOptions = {
  /**
   * Filtro `components` da Geocoding API (ex.: `locality:Pereiro|country:BR`).
   * Restringe o resultado — sem isso, "Centro, CE" cai em Sobral.
   */
  components?: string;
};

export async function geocodeAddress(
  address: string,
  options: GeocodeOptions = {},
): Promise<Result<GeocodeResult>> {
  const key = getGoogleMapsApiKey();
  if (!key) {
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Google Maps não configurado neste ambiente.',
    );
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
    url.searchParams.set('region', 'br');
    url.searchParams.set('language', 'pt-BR');
    if (options.components) {
      url.searchParams.set('components', options.components);
    }
    url.searchParams.set('key', key);

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Falha ao geocodificar o endereço.',
      );
    }

    const data = (await response.json()) as {
      status: string;
      results?: Array<{
        formatted_address: string;
        geometry: {
          location: { lat: number; lng: number };
          location_type?: GeocodeLocationType;
        };
        address_components?: Array<{
          long_name: string;
          short_name: string;
          types: string[];
        }>;
      }>;
    };

    if (data.status !== 'OK' || !data.results?.[0]) {
      return err('VALIDATION_ERROR', 'Não foi possível localizar o endereço.');
    }

    const result = data.results[0];
    const components = result.address_components ?? [];
    const find = (type: string) =>
      components.find((item) => item.types.includes(type));

    return ok({
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      city: find('administrative_area_level_2')?.long_name,
      state: find('administrative_area_level_1')?.short_name,
      postalCode: find('postal_code')?.long_name,
      locationType: result.geometry.location_type,
    });
  } catch (cause) {
    logger.captureAppError(
      {
        code: 'INTEGRATION_UNAVAILABLE',
        message: 'Erro ao chamar Geocoding API',
        cause,
      },
      {
        integration: 'google_maps_geocode',
        reason: describeError(cause),
      },
    );
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Serviço de mapas temporariamente indisponível.',
      { cause },
    );
  }
}

export async function reverseGeocodeCoords(
  point: GeoPoint,
): Promise<Result<GeocodeResult>> {
  const key = getGoogleMapsApiKey();
  if (!key) {
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Google Maps não configurado neste ambiente.',
    );
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${point.latitude},${point.longitude}`);
    url.searchParams.set('language', 'pt-BR');
    url.searchParams.set('key', key);

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Falha ao identificar o endereço do pin.',
      );
    }

    const data = (await response.json()) as {
      status: string;
      results?: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
        address_components?: Array<{
          long_name: string;
          short_name: string;
          types: string[];
        }>;
      }>;
    };

    if (data.status !== 'OK' || !data.results?.[0]) {
      return err(
        'VALIDATION_ERROR',
        'Não foi possível identificar o endereço do pin.',
      );
    }

    const result = data.results[0];
    const components = result.address_components ?? [];
    const find = (type: string) =>
      components.find((item) => item.types.includes(type));

    return ok({
      latitude: point.latitude,
      longitude: point.longitude,
      formattedAddress: result.formatted_address,
      city: find('administrative_area_level_2')?.long_name,
      state: find('administrative_area_level_1')?.short_name,
      postalCode: find('postal_code')?.long_name,
    });
  } catch (cause) {
    logger.captureAppError(
      {
        code: 'INTEGRATION_UNAVAILABLE',
        message: 'Erro ao chamar Geocoding API (reverse)',
        cause,
      },
      {
        integration: 'google_maps_reverse_geocode',
        reason: describeError(cause),
      },
    );
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Serviço de mapas temporariamente indisponível.',
      { cause },
    );
  }
}
