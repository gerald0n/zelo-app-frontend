/**
 * Wrapper fino da Places API (New) do Google, chamado **direto do navegador**
 * com a chave pública `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (restrição por
 * referrer + APIs Maps/Places no Google Cloud).
 *
 * Serve ao autocomplete de endereço do checkout: enquanto o cliente digita a
 * rua, `fetchPlaceSuggestions` traz sugestões enviesadas para Pereiro; ao
 * escolher uma, `fetchPlaceDetails` resolve o `placeId` numa coordenada
 * precisa (rooftop), dispensando a geocodificação por texto.
 *
 * Sem chave, tudo degrada em silêncio (`[]` / `null`) e o campo volta a ser um
 * input de texto puro.
 *
 * Módulo client-safe: não importa `logger` nem nada de servidor.
 */
import { findPereiroNeighborhood } from '@/modules/delivery/pereiro';

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places';

/** Centro urbano de Pereiro-CE — viés padrão quando não há coordenada da loja. */
const PEREIRO_CENTER = { latitude: -6.0485, longitude: -38.4612 } as const;

/** Raio do viés de localização (m). Cobre a área urbana com folga. */
const BIAS_RADIUS_METERS = 15_000;

/** A chave é inlined pelo Next no bundle do cliente. */
const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined;

export function hasPlacesBrowserKey(): boolean {
  return Boolean(BROWSER_KEY);
}

export type PlaceSuggestion = {
  placeId: string;
  /** Linha principal (rua/estabelecimento). */
  primaryText: string;
  /** Linha secundária (bairro, cidade). */
  secondaryText: string;
};

export type ResolvedPlace = {
  street: string;
  number: string;
  /** Bairro como o Google devolveu (antes de casar com a lista de Pereiro). */
  neighborhoodRaw: string;
  /** Bairro já casado com `PEREIRO_URBAN_NEIGHBORHOODS`, ou `''`. */
  neighborhood: string;
  /** `NaN` quando a cidade não é Pereiro (não confiar na coordenada). */
  latitude: number;
  longitude: number;
  formattedAddress: string;
  /** `true` quando `administrative_area_level_2` bate com "Pereiro". */
  cityMatches: boolean;
};

type FetchSuggestionsOptions = {
  sessionToken: string;
  bias?: { latitude: number; longitude: number };
  signal?: AbortSignal;
};

/** Token de sessão (autocomplete + 1 Place Details contam como 1 cobrança). */
export function createPlacesSessionToken(): string {
  return crypto.randomUUID();
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

type AutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
};

export async function fetchPlaceSuggestions(
  input: string,
  options: FetchSuggestionsOptions,
): Promise<PlaceSuggestion[]> {
  if (!BROWSER_KEY) return [];
  const query = input.trim();
  if (query.length < 3) return [];

  const center = options.bias ?? PEREIRO_CENTER;

  try {
    const response = await fetch(AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': BROWSER_KEY,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
      },
      body: JSON.stringify({
        input: query,
        sessionToken: options.sessionToken,
        languageCode: 'pt-BR',
        regionCode: 'BR',
        includedRegionCodes: ['br'],
        includedPrimaryTypes: ['street_address', 'route', 'premise'],
        locationBias: {
          circle: {
            center: {
              latitude: center.latitude,
              longitude: center.longitude,
            },
            radius: BIAS_RADIUS_METERS,
          },
        },
      }),
      signal: options.signal,
    });

    if (!response.ok) return [];

    const data = (await response.json()) as AutocompleteResponse;
    return (data.suggestions ?? [])
      .map((item) => item.placePrediction)
      .filter((prediction): prediction is NonNullable<typeof prediction> =>
        Boolean(prediction?.placeId),
      )
      .map((prediction) => ({
        placeId: prediction.placeId as string,
        primaryText:
          prediction.structuredFormat?.mainText?.text ??
          prediction.text?.text ??
          '',
        secondaryText: prediction.structuredFormat?.secondaryText?.text ?? '',
      }));
  } catch {
    // AbortError (request obsoleto) ou falha de rede: sem sugestões, sem ruído.
    return [];
  }
}

type PlaceDetailsResponse = {
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
};

export async function fetchPlaceDetails(
  placeId: string,
  sessionToken: string,
): Promise<ResolvedPlace | null> {
  if (!BROWSER_KEY) return null;

  try {
    const url = new URL(`${DETAILS_URL}/${encodeURIComponent(placeId)}`);
    url.searchParams.set('sessionToken', sessionToken);
    url.searchParams.set('languageCode', 'pt-BR');
    url.searchParams.set('regionCode', 'BR');

    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': BROWSER_KEY,
        'X-Goog-FieldMask':
          'id,location,addressComponents,formattedAddress,shortFormattedAddress,types',
      },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as PlaceDetailsResponse;
    const components = data.addressComponents ?? [];
    const pick = (type: string) =>
      components.find((component) => component.types?.includes(type));

    const street = pick('route')?.longText ?? '';
    const number = pick('street_number')?.longText ?? '';
    const neighborhoodRaw =
      pick('sublocality_level_1')?.longText ??
      pick('sublocality')?.longText ??
      pick('administrative_area_level_4')?.longText ??
      '';
    const municipality =
      pick('administrative_area_level_2')?.longText ??
      pick('locality')?.longText ??
      '';

    const cityMatches = normalize(municipality) === 'pereiro';
    const lat = data.location?.latitude;
    const lng = data.location?.longitude;

    return {
      street,
      number,
      neighborhoodRaw,
      neighborhood: findPereiroNeighborhood(neighborhoodRaw)?.name ?? '',
      latitude: cityMatches && typeof lat === 'number' ? lat : Number.NaN,
      longitude: cityMatches && typeof lng === 'number' ? lng : Number.NaN,
      formattedAddress:
        data.shortFormattedAddress ?? data.formattedAddress ?? '',
      cityMatches,
    };
  } catch {
    return null;
  }
}
