import type { DeliveryQuoteSource } from '@/modules/delivery';
import type { LocationSource } from '@/modules/delivery/geo';

export type DeliveryType = 'delivery' | 'pickup';
export type ScheduleType = 'now' | 'scheduled';
export type PaymentMethod = 'pix' | 'cash' | 'card';
/** Origem do pedido: cardápio normal (Pereiro) ou o local satélite de São Miguel/RN. */
export type FulfillmentLocation = 'pereiro' | 'sao_miguel';

export type CheckoutAddress = {
  street: string;
  number: string;
  neighborhood: string;
  complement: string;
  referencePoint: string;
  city: string;
  state: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  /** Endereço formatado pelo Google pra coordenada atual (pode não existir). */
  formattedAddress?: string;
  /** Como a coordenada atual foi definida. */
  locationSource?: LocationSource;
  /** `accuracy` do GPS quando `locationSource === 'current_location'`. */
  locationAccuracyMeters?: number;
  /** Pin arrastado longe de uma posição de alta confiança anterior. */
  locationDiverged?: boolean;
};

/**
 * Chaves que só carregam metadados da MESMA coordenada (não uma edição de
 * endereço nova) — atualizam sem resetar cotação/distância/taxa já obtidas,
 * só invalidam a confirmação do pin. Usado pelo arraste do pin
 * (`revalidateWithCoords`), que dispara sua própria revalidação debounced.
 */
export const LOCATION_METADATA_KEYS = new Set([
  'latitude',
  'longitude',
  'locationSource',
  'locationAccuracyMeters',
  'locationDiverged',
]);

export type CheckoutState = {
  fulfillmentLocation: FulfillmentLocation;
  /** id real do local satélite (vem do /checkout/options) — null até carregar. */
  satelliteLocationId: string | null;
  /** `true` só no carrinho de pronta entrega (São Miguel) — nunca mistura com encomenda. */
  prontaEntrega: boolean;
  deliveryType: DeliveryType;
  scheduleType: ScheduleType;
  scheduledDate?: string;
  scheduledTime?: string;
  /** Texto legado / resumo do endereço. */
  address: string;
  addressDetails: CheckoutAddress;
  routeDistanceMeters?: number;
  deliveryFeeCents: number;
  deliveryInServiceArea?: boolean;
  deliveryQuoteSource?: DeliveryQuoteSource;
  locationConfirmed: boolean;
  paymentMethod: PaymentMethod;
  changeFor: string;
  note: string;
};

const ADDRESS_DEFAULTS: Record<FulfillmentLocation, { city: string; state: string }> = {
  pereiro: { city: 'Pereiro', state: 'CE' },
  sao_miguel: { city: 'São Miguel', state: 'RN' },
};

export function emptyAddressFor(location: FulfillmentLocation): CheckoutAddress {
  return {
    street: '',
    number: '',
    neighborhood: '',
    complement: '',
    referencePoint: '',
    ...ADDRESS_DEFAULTS[location],
    postalCode: '',
  };
}

export const initialCheckoutState: CheckoutState = {
  fulfillmentLocation: 'pereiro',
  satelliteLocationId: null,
  prontaEntrega: false,
  deliveryType: 'delivery',
  scheduleType: 'now',
  address: '',
  addressDetails: emptyAddressFor('pereiro'),
  deliveryFeeCents: 0,
  locationConfirmed: false,
  paymentMethod: 'pix',
  changeFor: '',
  note: '',
};

export function formatAddressSummary(details: CheckoutAddress): string {
  const base = [
    details.street,
    details.number,
    details.neighborhood,
    details.city,
    details.state,
  ]
    .filter(Boolean)
    .join(', ');
  if (details.complement) return `${base} · ${details.complement}`;
  return base;
}

/**
 * `fulfillmentLocation`/`satelliteLocationId`/`prontaEntrega` sobrevivem a um
 * F5 no meio do checkout (o resto do estado — endereço, agendamento — é
 * ephemeral de propósito, igual já era antes). Sem isso, um refresh durante
 * o checkout de pronta entrega volta pro fluxo de encomenda normal: o
 * servidor ainda rejeita o pedido com segurança (produto de pronta entrega
 * não bate com o modo), mas o cliente cai num beco sem saída confuso.
 */
const FULFILLMENT_STORAGE_KEY = '@zelo/checkout-fulfillment:v1';

export type PersistedFulfillment = {
  fulfillmentLocation: FulfillmentLocation;
  satelliteLocationId: string | null;
  prontaEntrega: boolean;
};

export function loadPersistedFulfillment(): PersistedFulfillment | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FULFILLMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedFulfillment> | null;
    if (
      !parsed ||
      (parsed.fulfillmentLocation !== 'pereiro' &&
        parsed.fulfillmentLocation !== 'sao_miguel')
    ) {
      return null;
    }
    return {
      fulfillmentLocation: parsed.fulfillmentLocation,
      satelliteLocationId:
        typeof parsed.satelliteLocationId === 'string'
          ? parsed.satelliteLocationId
          : null,
      prontaEntrega: Boolean(parsed.prontaEntrega),
    };
  } catch {
    return null;
  }
}

export function savePersistedFulfillment(value: PersistedFulfillment): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FULFILLMENT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // localStorage indisponível (modo privado etc.) — segue só em memória.
  }
}
