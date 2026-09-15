import type { CategorySchedulingRule } from '@/modules/scheduling/category-rules';

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
  /** Regras de agendamento aplicadas aos produtos desta categoria. */
  scheduling: CategorySchedulingRule;
};

export type CatalogProduct = {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  description: string;
  /** Preço final — já com o desconto de uma promoção ativa aplicado. */
  price: number;
  /** Preço de tabela, presente só quando há desconto ativo (`price` difere). */
  originalPrice?: number;
  /** Percentual da promoção ativa aplicada a `price`, se houver. */
  discountPercent?: number;
  /** Public URL of the primary photo, or null. */
  image: string | null;
  imageAlt: string | null;
  /**
   * Todas as fotos do produto, principal primeiro (a mesma da `image`).
   * Vazio quando o produto não tem foto. Usada na galeria da página do produto.
   */
  images: Array<{ url: string; alt: string | null }>;
  available: boolean;
  weight?: string;
  addons: CatalogAddon[];
  sortOrder: number;
  /** Média (0–5, 1 casa) e nº de avaliações aprovadas. `null` = ainda sem. */
  rating: { average: number; count: number } | null;
  /** 'pizza_flavor' = sabor de pizza; `price` é ignorado, usar `pizzaPrices`. */
  productType: 'standard' | 'pizza_flavor';
  /** Preço deste sabor por tamanho de pizza. Só presente quando `productType = 'pizza_flavor'`. */
  pizzaPrices?: Array<{ sizeId: string; priceCents: number }>;
  /**
   * Foto de preview do sabor sem a borda da massa (só o recheio), usada no
   * círculo do construtor de pizza — a borda é sobreposta via CSS por cima
   * dela. Só relevante quando `productType = 'pizza_flavor'`; `null` quando
   * não configurada (o preview cai de volta pra `image`).
   */
  previewImage: string | null;
  previewImageAlt: string | null;
};

/** Tamanho de pizza (global, não por sabor) — ver `pizza_sizes`. */
export type CatalogPizzaSize = {
  id: string;
  name: string;
  diameterCm: number;
  sortOrder: number;
};

/** Adicional de pizza, com preço diferente se aplicado à metade ou à pizza toda. */
export type CatalogPizzaAddon = {
  id: string;
  name: string;
  description: string | null;
  priceHalfCents: number;
  priceFullCents: number;
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

export type CatalogBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  linkHref: string | null;
  imageUrl: string;
};

export type CatalogPaymentMethods = {
  pix: boolean;
  cash: boolean;
  card: boolean;
};

export type CatalogStore = {
  id: string;
  name: string;
  /** CNPJ do MEI, exibido no cabeçalho do comprovante impresso. */
  cnpj: string | null;
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
  /** Raio máximo de entrega (m, linha reta); além dele, só retirada. */
  maxDeliveryRadiusMeters: number;
  timezone: string;
  /** Estimativa de taxa de pagamento (basis points; 99 = 0,99%). */
  paymentFeeEstimateBps: number;
  isOpenOverride: boolean | null;
  /** Instante em que a loja volta a abrir sozinha (pausa com prazo). */
  pausedUntil: string | null;
  /** Motivo da pausa, mostrado só pro time no admin. */
  pauseReason: string | null;
  acceptsPayments: CatalogPaymentMethods;
  businessHours: CatalogBusinessHour[];
  blackoutPeriods: CatalogBlackout[];
};

/**
 * Um horário fixo de entrega oferecido pelo local satélite num dia da
 * semana — lista curta e explícita (ex.: rota do meio-dia + um horário à
 * noite), não uma grade derivada por intervalo como a de Pereiro.
 */
export type SatelliteDeliverySlot = {
  weekday: number;
  /** HH:MM. */
  startsAt: string;
  /** HH:MM — fim da janela, quando o slot representa um intervalo (ex.: rota do meio-dia). */
  endsAt: string | null;
  label: string | null;
  sortOrder: number;
};

export type SatelliteWeekdayHour = {
  weekday: number;
  isClosed: boolean;
  /** HH:MM — janela de retirada (sem grade de horários, é "qualquer horário nessa janela"). */
  pickupOpensAt: string | null;
  pickupClosesAt: string | null;
  deliveryEnabled: boolean;
};

/**
 * Segundo local de atendimento (satélite), ativo só em alguns dias da
 * semana, com endereço/raio/taxa próprios — ver `packages/shared/src/modules/scheduling/satellite-slots.ts`.
 * O shape de geo/raio/taxa é compatível com `StoreOrigin`
 * (`@/modules/delivery/quote`), então dá pra passar direto pro cálculo de
 * taxa de entrega sem adaptação.
 */
export type SatelliteLocation = {
  id: string;
  slug: string;
  name: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string | null;
  latitude: number;
  longitude: number;
  freeDeliveryRadiusMeters: number;
  fixedDeliveryFeeCents: number;
  maxDeliveryRadiusMeters: number;
  minLeadMinutes: number;
  timezone: string;
  isActive: boolean;
  hours: SatelliteWeekdayHour[];
  deliverySlots: SatelliteDeliverySlot[];
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
