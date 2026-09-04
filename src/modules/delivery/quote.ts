import { err, ok, type Result } from '@/lib/errors';
import { calcDeliveryFeeCents } from '@/modules/delivery/fee';
import {
  findPereiroNeighborhood,
  isPereiroUrbanNeighborhood,
} from '@/modules/delivery/pereiro';
import {
  geocodeAddress,
  getDrivingDistanceMeters,
  hasGoogleMapsServerKey,
  type GeoPoint,
} from '@/modules/delivery/maps';
import { estimateRoadDistanceMeters } from '@/modules/delivery/geo';
import { geocodeAddressOsm } from '@/modules/delivery/osm';

export type DeliveryQuoteSource =
  | 'google_maps'
  | 'openstreetmap'
  | 'local_fallback';

export type DeliveryAddressInput = {
  street: string;
  number: string;
  neighborhood: string;
  complement?: string;
  referencePoint?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  /** Quando o cliente ajusta o pin no mapa. */
  latitude?: number;
  longitude?: number;
};

export type DeliveryQuote = {
  inServiceArea: boolean;
  routeDistanceMeters: number;
  deliveryFeeCents: number;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  source: DeliveryQuoteSource;
  message?: string;
};

export type StoreOrigin = {
  latitude: number;
  longitude: number;
  freeDeliveryRadiusMeters: number;
  fixedDeliveryFeeCents: number;
  addressLine: string;
  city: string;
  state: string;
};

function composeAddress(input: DeliveryAddressInput): string {
  const parts = [
    input.street,
    input.number,
    input.neighborhood,
    input.city ?? 'Pereiro',
    input.state ?? 'CE',
    'Brasil',
  ].filter(Boolean);
  return parts.join(', ');
}

/**
 * Só rua + número + bairro, sem cidade/estado. Para a Geocoding API do Google
 * com filtro `components`: se o texto trouxer "Centro, CE, Brasil" o Google
 * ignora o filtro e casa com o Centro de Sobral (~250 km).
 */
function composeStreetAddress(input: DeliveryAddressInput): string {
  return [input.street, input.number, input.neighborhood]
    .filter(Boolean)
    .join(', ');
}

/**
 * Trava a geocodificação na cidade da loja. Sem isso o Google resolve
 * "Centro" como Sobral (cidade grande ~250 km a noroeste).
 */
function geocodeComponents(input: DeliveryAddressInput): string {
  const locality = input.city ?? 'Pereiro';
  const area = input.state ?? 'CE';
  return `locality:${locality}|administrative_area:${area}|country:BR`;
}

async function resolveCoordinates(
  input: DeliveryAddressInput,
  neighborhood: { latitude: number; longitude: number },
): Promise<{
  latitude: number;
  longitude: number;
  formattedAddress: string;
  source: DeliveryQuoteSource;
}> {
  if (input.latitude != null && input.longitude != null) {
    return {
      latitude: input.latitude,
      longitude: input.longitude,
      formattedAddress: composeAddress(input),
      source: hasGoogleMapsServerKey() ? 'google_maps' : 'openstreetmap',
    };
  }

  if (hasGoogleMapsServerKey()) {
    const geo = await geocodeAddress(composeStreetAddress(input), {
      components: geocodeComponents(input),
    });
    if (geo.ok) {
      return {
        latitude: geo.data.latitude,
        longitude: geo.data.longitude,
        formattedAddress: geo.data.formattedAddress,
        source: 'google_maps',
      };
    }
  }

  const osm = await geocodeAddressOsm(composeAddress(input));
  if (osm.ok) {
    return {
      latitude: osm.data.latitude,
      longitude: osm.data.longitude,
      formattedAddress: osm.data.formattedAddress,
      source: 'openstreetmap',
    };
  }

  return {
    latitude: neighborhood.latitude,
    longitude: neighborhood.longitude,
    formattedAddress: composeAddress(input),
    source: 'local_fallback',
  };
}

async function resolveRouteDistance(
  origin: GeoPoint,
  destination: GeoPoint,
  preferred: DeliveryQuoteSource,
): Promise<{ meters: number; source: DeliveryQuoteSource }> {
  // Com chave, a Routes API é sempre o caminho principal — mesmo quando o ponto
  // veio do OSM ou do bairro, ela dá a distância viária real entre as coordenadas.
  if (hasGoogleMapsServerKey()) {
    const google = await getDrivingDistanceMeters(origin, destination);
    if (google.ok) {
      return { meters: google.data, source: 'google_maps' };
    }
  }

  // Sem Routes API: linha reta × 1,3. A confiança herda a origem do ponto.
  return {
    meters: estimateRoadDistanceMeters(origin, destination),
    source: preferred,
  };
}

export async function quoteDelivery(
  input: DeliveryAddressInput,
  store: StoreOrigin,
): Promise<Result<DeliveryQuote>> {
  if (
    !input.street.trim() ||
    !input.number.trim() ||
    !input.neighborhood.trim()
  ) {
    return err(
      'VALIDATION_ERROR',
      'Informe rua, número e bairro para calcular a entrega.',
    );
  }

  if (!isPereiroUrbanNeighborhood(input.neighborhood)) {
    return ok({
      inServiceArea: false,
      routeDistanceMeters: 0,
      deliveryFeeCents: 0,
      latitude: store.latitude,
      longitude: store.longitude,
      formattedAddress: composeAddress(input),
      source: 'local_fallback',
      message:
        'Endereço fora da área urbana de Pereiro. Você pode concluir por retirada na loja.',
    });
  }

  const neighborhood = findPereiroNeighborhood(input.neighborhood)!;
  const resolved = await resolveCoordinates(input, neighborhood);
  const route = await resolveRouteDistance(
    { latitude: store.latitude, longitude: store.longitude },
    { latitude: resolved.latitude, longitude: resolved.longitude },
    resolved.source,
  );

  const routeDistanceMeters =
    route.meters >= 0 ? route.meters : neighborhood.roadDistanceMeters;
  const source: DeliveryQuoteSource =
    route.meters >= 0 ? route.source : 'local_fallback';

  return ok({
    inServiceArea: true,
    routeDistanceMeters,
    deliveryFeeCents: calcDeliveryFeeCents(
      routeDistanceMeters,
      store.freeDeliveryRadiusMeters,
      store.fixedDeliveryFeeCents,
    ),
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    formattedAddress: resolved.formattedAddress,
    source,
    message:
      source === 'local_fallback'
        ? 'Cotação estimada por bairro. Confirme o pin no mapa.'
        : undefined,
  });
}
