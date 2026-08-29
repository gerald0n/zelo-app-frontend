export function calcDeliveryFeeCents(
  distanceMeters: number,
  freeRadiusMeters = 2000,
  fixedFeeCents = 500,
): number {
  if (distanceMeters < 0) return fixedFeeCents;
  return distanceMeters <= freeRadiusMeters ? 0 : fixedFeeCents;
}
