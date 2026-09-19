export const NEARBY_DELIVERY_FEE_CENTS = 300;

export function calcDeliveryFeeCents(
  distanceMeters: number,
  nearbyRadiusMeters = 1000,
  fixedFeeCents = 500,
): number {
  if (distanceMeters < 0) return fixedFeeCents;
  return distanceMeters <= nearbyRadiusMeters
    ? NEARBY_DELIVERY_FEE_CENTS
    : fixedFeeCents;
}
