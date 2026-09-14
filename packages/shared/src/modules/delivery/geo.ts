import type { GeoPoint } from '@/modules/delivery/maps';

const EARTH_RADIUS_METERS = 6_371_000;

/** Como a coordenada confirmada de um endereço/pedido foi definida. */
export type LocationSource = 'geocoded' | 'current_location' | 'manual_pin';

/**
 * Distância (m) acima da qual um pin arrastado é considerado divergente da
 * posição de alta confiança anterior (autocomplete/geocode preciso) — só
 * avaliado quando essa posição de referência existir, pra não gerar falso
 * positivo ao corrigir um fallback genérico (centro da cidade).
 */
export const PIN_DIVERGENCE_METERS = 250;

/**
 * Acima desse `accuracy` (m) do GPS do navegador, avisamos o cliente pra
 * conferir o pin — não bloqueia o fluxo, só é informativo.
 */
export const LOW_GPS_ACCURACY_METERS = 100;

/**
 * Fator de sinuosidade: quanto uma rota por rua costuma ser mais longa que a
 * linha reta em malha urbana. Usado só quando não há rota do Google.
 */
const ROAD_WINDING_FACTOR = 1.3;

/** Distância em linha reta (Haversine) entre dois pontos, em metros. */
export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/**
 * Estimativa de distância viária quando a Routes API não responde: linha reta
 * × 1,3. Substitui o antigo fallback pelo servidor público de demonstração do
 * OSRM, que não é para produção e mal conhece as ruas de Pereiro.
 */
export function estimateRoadDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  return Math.round(haversineDistanceMeters(a, b) * ROAD_WINDING_FACTOR);
}
