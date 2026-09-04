import { getGoogleMapsApiKey } from '@/config/env';
import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type GeocodeResult = GeoPoint & {
  formattedAddress: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

export function hasGoogleMapsServerKey(): boolean {
  return Boolean(getGoogleMapsApiKey());
}

export async function geocodeAddress(
  address: string,
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
        geometry: { location: { lat: number; lng: number } };
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
    });
  } catch (cause) {
    logger.captureAppError(
      {
        code: 'INTEGRATION_UNAVAILABLE',
        message: 'Erro ao chamar Geocoding API',
        cause,
      },
      { integration: 'google_maps_geocode' },
    );
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Serviço de mapas temporariamente indisponível.',
      { cause },
    );
  }
}

export async function getDrivingDistanceMeters(
  origin: GeoPoint,
  destination: GeoPoint,
): Promise<Result<number>> {
  const key = getGoogleMapsApiKey();
  if (!key) {
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Google Maps não configurado neste ambiente.',
    );
  }

  try {
    const response = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'routes.distanceMeters',
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: {
                latitude: origin.latitude,
                longitude: origin.longitude,
              },
            },
          },
          destination: {
            location: {
              latLng: {
                latitude: destination.latitude,
                longitude: destination.longitude,
              },
            },
          },
          travelMode: 'DRIVE',
          units: 'METRIC',
        }),
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!response.ok) {
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Falha ao calcular a rota de entrega.',
      );
    }

    const data = (await response.json()) as {
      routes?: Array<{ distanceMeters?: number }>;
    };

    const route = data.routes?.[0];
    if (!route) {
      return err(
        'VALIDATION_ERROR',
        'Não foi possível calcular a rota até o endereço.',
      );
    }

    // A Routes API omite `distanceMeters` quando é 0 (semântica proto3).
    return ok(route.distanceMeters ?? 0);
  } catch (cause) {
    logger.captureAppError(
      {
        code: 'INTEGRATION_UNAVAILABLE',
        message: 'Erro ao chamar Routes API',
        cause,
      },
      { integration: 'google_maps_routes' },
    );
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Serviço de rota temporariamente indisponível.',
      { cause },
    );
  }
}
