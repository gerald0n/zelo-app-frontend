import type { GeoPoint } from '@/modules/delivery/maps';

const EARTH_RADIUS_METERS = 6_371_000;

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
