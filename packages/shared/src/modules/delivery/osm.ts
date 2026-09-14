import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { GeoPoint, GeocodeResult } from '@/modules/delivery/maps';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'ZeloConfeitaria/1.0 (https://zeloconfeitaria.com.br)';

/** Margem (graus) ao redor da origem pro recorte de viés de geocodificação. */
const VIEWBOX_MARGIN_DEGREES = 0.05;

/** Recorte (left, bottom, right, top) centrado na origem — loja ou local satélite. */
function viewboxAround(origin: GeoPoint): string {
  const left = origin.longitude - VIEWBOX_MARGIN_DEGREES;
  const right = origin.longitude + VIEWBOX_MARGIN_DEGREES;
  const bottom = origin.latitude - VIEWBOX_MARGIN_DEGREES;
  const top = origin.latitude + VIEWBOX_MARGIN_DEGREES;
  return `${left},${bottom},${right},${top}`;
}

export async function geocodeAddressOsm(
  address: string,
  origin: GeoPoint,
): Promise<Result<GeocodeResult>> {
  try {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('q', address);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('countrycodes', 'br');
    url.searchParams.set('viewbox', viewboxAround(origin));
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
