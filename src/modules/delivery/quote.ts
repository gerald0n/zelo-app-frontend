import { err, ok, type Result } from '@/lib/errors';
import { calcDeliveryFeeCents } from '@/modules/delivery/fee';
import {
  geocodeAddress,
  reverseGeocodeCoords,
  hasGoogleMapsServerKey,
} from '@/modules/delivery/maps';
import { geocodeAddressOsm } from '@/modules/delivery/osm';
import { haversineDistanceMeters } from '@/modules/delivery/geo';

/** Centro de Pereiro-CE — âncora quando não conseguimos localizar o endereço. */
const PEREIRO_CENTER = { latitude: -6.0485, longitude: -38.4612 } as const;

export type DeliveryQuoteSource =
  | 'google_maps'
  | 'openstreetmap'
  | 'local_fallback';

export type DeliveryAddressInput = {
  street: string;
  number: string;
  /** Opcional — só rótulo para o entregador e dica de geocodificação. */
  neighborhood?: string;
  complement?: string;
  referencePoint?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  /** Coordenada do autocomplete (placeId) ou do pin ajustado no mapa. */
  latitude?: number;
  longitude?: number;
};

/**
 * `low` quando a coordenada é um "chute" (Google aproximado/centro de área,
 * OSM ou âncora local) — o cliente precisa conferir o pin com atenção.
 * `high` quando veio de rooftop/interpolação, do autocomplete (placeId) ou de
 * um pin que o próprio cliente já posicionou.
 */
export type LocationPrecision = 'high' | 'low';

export type DeliveryQuote = {
  inServiceArea: boolean;
  /** Distância loja→cliente em linha reta, em metros (nome mantido por schema). */
  routeDistanceMeters: number;
  deliveryFeeCents: number;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  source: DeliveryQuoteSource;
  locationPrecision: LocationPrecision;
  message?: string;
};

export type StoreOrigin = {
  latitude: number;
  longitude: number;
  freeDeliveryRadiusMeters: number;
  fixedDeliveryFeeCents: number;
  maxDeliveryRadiusMeters: number;
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

/** `location_type` da Geocoding API que indica um "chute" impreciso. */
const LOW_CONFIDENCE_LOCATION_TYPES = new Set([
  'GEOMETRIC_CENTER',
  'APPROXIMATE',
]);

async function resolveCoordinates(input: DeliveryAddressInput): Promise<{
  latitude: number;
  longitude: number;
  formattedAddress: string;
  source: DeliveryQuoteSource;
  locationPrecision: LocationPrecision;
}> {
  if (input.latitude != null && input.longitude != null) {
    // Coordenada vem do autocomplete (placeId) ou do pin arrastado no mapa —
    // em ambos os casos o cliente já apontou o lugar certo, então a precisão
    // é sempre alta. Reverse geocode só traz o endereço real do ponto em vez
    // de ecoar o texto digitado.
    if (hasGoogleMapsServerKey()) {
      const reverse = await reverseGeocodeCoords({
        latitude: input.latitude,
        longitude: input.longitude,
      });
      if (reverse.ok) {
        return {
          latitude: input.latitude,
          longitude: input.longitude,
          formattedAddress: reverse.data.formattedAddress,
          source: 'google_maps',
          locationPrecision: 'high',
        };
      }
    }

    return {
      latitude: input.latitude,
      longitude: input.longitude,
      formattedAddress: composeAddress(input),
      source: hasGoogleMapsServerKey() ? 'google_maps' : 'openstreetmap',
      locationPrecision: 'high',
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
        locationPrecision:
          geo.data.locationType &&
          LOW_CONFIDENCE_LOCATION_TYPES.has(geo.data.locationType)
            ? 'low'
            : 'high',
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
      // Nominatim não devolve um sinal de precisão comparável ao Google —
      // trata como baixa confiança por padrão.
      locationPrecision: 'low',
    };
  }

  // Não localizamos: ancora no centro de Pereiro e pede o pin no mapa.
  return {
    latitude: PEREIRO_CENTER.latitude,
    longitude: PEREIRO_CENTER.longitude,
    formattedAddress: composeAddress(input),
    source: 'local_fallback',
    locationPrecision: 'low',
  };
}

/** "1,4 km" / "800 m" para as mensagens ao cliente. */
function formatDistance(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1).replace('.', ',')} km`
    : `${Math.round(meters / 50) * 50} m`;
}

export async function quoteDelivery(
  input: DeliveryAddressInput,
  store: StoreOrigin,
): Promise<Result<DeliveryQuote>> {
  if (!input.street.trim() || !input.number.trim()) {
    return err(
      'VALIDATION_ERROR',
      'Informe a rua e o número para calcular a entrega.',
    );
  }

  const resolved = await resolveCoordinates(input);
  const straightMeters = Math.round(
    haversineDistanceMeters(
      { latitude: store.latitude, longitude: store.longitude },
      { latitude: resolved.latitude, longitude: resolved.longitude },
    ),
  );

  if (straightMeters > store.maxDeliveryRadiusMeters) {
    return ok({
      inServiceArea: false,
      routeDistanceMeters: straightMeters,
      deliveryFeeCents: 0,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      formattedAddress: resolved.formattedAddress,
      source: resolved.source,
      locationPrecision: resolved.locationPrecision,
      message: `Endereço a ${formatDistance(straightMeters)} da loja — fora da área de entrega (até ${formatDistance(store.maxDeliveryRadiusMeters)}). Você pode concluir por retirada na loja.`,
    });
  }

  return ok({
    inServiceArea: true,
    routeDistanceMeters: straightMeters,
    deliveryFeeCents: calcDeliveryFeeCents(
      straightMeters,
      store.freeDeliveryRadiusMeters,
      store.fixedDeliveryFeeCents,
    ),
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    formattedAddress: resolved.formattedAddress,
    source: resolved.source,
    locationPrecision: resolved.locationPrecision,
    message:
      resolved.source === 'local_fallback'
        ? 'Não localizamos o endereço exato. Arraste o pin no mapa até o local.'
        : resolved.locationPrecision === 'low'
          ? 'Localização aproximada — confira com atenção se o pin está no lugar certo.'
          : undefined,
  });
}
