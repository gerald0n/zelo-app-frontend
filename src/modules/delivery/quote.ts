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
import {
  geocodeAddressOsm,
  getDrivingDistanceOsm,
} from '@/modules/delivery/osm';

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
    const geo = await geocodeAddress(composeAddress(input));
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
  if (hasGoogleMapsServerKey() && preferred === 'google_maps') {
    const google = await getDrivingDistanceMeters(origin, destination);
    if (google.ok) {
      return { meters: google.data, source: 'google_maps' };
    }
  }

  const osm = await getDrivingDistanceOsm(origin, destination);
  if (osm.ok) {
    return {
      meters: osm.data,
      source: preferred === 'local_fallback' ? 'openstreetmap' : preferred,
    };
  }

  return { meters: -1, source: preferred };
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
