export type CatalogAddon = {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
  description?: string | null;
};

export type CatalogCategory = {
  id: string;
  name: string;
  sortOrder: number;
};

export type CatalogProduct = {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  /** Public URL of the primary photo, or null. */
  image: string | null;
  imageAlt: string | null;
  available: boolean;
  weight?: string;
  addons: CatalogAddon[];
  sortOrder: number;
};

export type CatalogBusinessHour = {
  weekday: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
};

export type CatalogBlackout = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};

export type CatalogPaymentMethods = {
  pix: boolean;
  cash: boolean;
  card: boolean;
};

export type CatalogStore = {
  id: string;
  name: string;
  phoneE164: string;
  whatsappE164: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string | null;
  latitude: number;
  longitude: number;
  freeDeliveryRadiusMeters: number;
  fixedDeliveryFeeCents: number;
  timezone: string;
  isOpenOverride: boolean | null;
  acceptsPayments: CatalogPaymentMethods;
  businessHours: CatalogBusinessHour[];
  blackoutPeriods: CatalogBlackout[];
  /** Horários candidatos de agendamento (HH:MM), configurados no admin. */
  scheduleSlotTimes: string[];
};

export function formatWeightGrams(
  min: number | null,
  max: number | null,
): string | undefined {
  if (min == null && max == null) return undefined;
  if (min != null && max != null && min === max) return `~${min} g`;
  if (min != null && max != null) return `~${min}–${max} g`;
  if (min != null) return `~${min} g`;
  return `~${max} g`;
}

export function formatCatalogPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

export function categoryTone(
  categoryName: string,
): 'cookie' | 'pudim' | 'salgado' {
  const normalized = categoryName.toLowerCase();
  if (normalized.includes('cookie')) return 'cookie';
  if (normalized.includes('pudim')) return 'pudim';
  return 'salgado';
}
