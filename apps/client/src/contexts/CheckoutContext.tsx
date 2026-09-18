'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { DeliveryQuoteSource } from '@/modules/delivery';
import { useCartStore } from '@/modules/carts';
import {
  emptyAddressFor,
  formatAddressSummary,
  initialCheckoutState,
  loadPersistedFulfillment,
  LOCATION_METADATA_KEYS,
  savePersistedFulfillment,
  type CheckoutAddress,
  type CheckoutState,
  type DeliveryType,
  type FulfillmentLocation,
  type PaymentMethod,
} from '@/contexts/checkout-state';

export type {
  CheckoutAddress,
  CheckoutState,
  DeliveryType,
  FulfillmentLocation,
  PaymentMethod,
} from '@/contexts/checkout-state';

type CheckoutContextType = {
  checkout: CheckoutState;
  setFulfillmentLocation: (
    location: FulfillmentLocation,
    options?: { prontaEntrega?: boolean },
  ) => void;
  setSatelliteLocationId: (id: string) => void;
  setDeliveryType: (t: DeliveryType) => void;
  setScheduledDate: (d: string) => void;
  setScheduledTime: (t: string) => void;
  setAddress: (a: string) => void;
  setAddressDetails: (details: Partial<CheckoutAddress>) => void;
  setDeliveryQuote: (quote: {
    routeDistanceMeters: number;
    deliveryFeeCents: number;
    inServiceArea: boolean;
    source: DeliveryQuoteSource;
    latitude: number;
    longitude: number;
    formattedAddress: string;
    locationConfirmed?: boolean;
  }) => void;
  clearDeliveryQuote: () => void;
  setLocationConfirmed: (confirmed: boolean) => void;
  setPaymentMethod: (m: PaymentMethod) => void;
  setChangeFor: (c: string) => void;
  setNote: (n: string) => void;
  resetCheckout: () => void;
};

const CheckoutContext = createContext<CheckoutContextType | null>(null);

export function CheckoutProvider({ children }: { children: React.ReactNode }) {
  const [checkout, setCheckout] = useState<CheckoutState>(initialCheckoutState);

  // Restaura fulfillmentLocation/satelliteLocationId/prontaEntrega após um
  // F5 no meio do checkout — só se o carrinho (persistido à parte, no
  // zustand) ainda tiver itens. Carrinho vazio = nada em andamento, então
  // ignora um valor persistido antigo em vez de deixar o cliente "preso" no
  // modo São Miguel pra sempre. A reidratação do zustand-persist é síncrona,
  // então `getState()` aqui já reflete o carrinho salvo.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (useCartStore.getState().items.length === 0) return;
    const persisted = loadPersistedFulfillment();
    if (!persisted) return;
    if (persisted.fulfillmentLocation === 'pereiro' && !persisted.prontaEntrega) {
      return;
    }
    // Mesmo padrão de `CartSync` (queueMicrotask após hidratação síncrona):
    // adia a atualização pra fora do corpo síncrono do efeito.
    queueMicrotask(() => {
      setCheckout((p) => ({
        ...p,
        fulfillmentLocation: persisted.fulfillmentLocation,
        satelliteLocationId: persisted.satelliteLocationId,
        prontaEntrega: persisted.prontaEntrega,
        addressDetails: emptyAddressFor(persisted.fulfillmentLocation),
      }));
    });
  }, []);

  // Mantém o localStorage em dia sempre que um destes três campos muda —
  // são os únicos que sobrevivem a um refresh (ver comentário acima).
  useEffect(() => {
    savePersistedFulfillment({
      fulfillmentLocation: checkout.fulfillmentLocation,
      satelliteLocationId: checkout.satelliteLocationId,
      prontaEntrega: checkout.prontaEntrega,
    });
  }, [
    checkout.fulfillmentLocation,
    checkout.satelliteLocationId,
    checkout.prontaEntrega,
  ]);

  const setFulfillmentLocation = useCallback(
    (location: FulfillmentLocation, options?: { prontaEntrega?: boolean }) => {
      setCheckout((p) => {
        if (
          p.fulfillmentLocation === location &&
          (options?.prontaEntrega ?? p.prontaEntrega) === p.prontaEntrega
        ) {
          return p;
        }
        return {
          ...p,
          fulfillmentLocation: location,
          satelliteLocationId: location === 'pereiro' ? null : p.satelliteLocationId,
          prontaEntrega: options?.prontaEntrega ?? false,
          // Datas/horários/taxa de um local não valem pro outro.
          scheduledDate: undefined,
          scheduledTime: undefined,
          addressDetails: emptyAddressFor(location),
          address: '',
          routeDistanceMeters: undefined,
          deliveryFeeCents: 0,
          deliveryInServiceArea: undefined,
          deliveryQuoteSource: undefined,
          locationConfirmed: p.deliveryType === 'pickup',
        };
      });
    },
    [],
  );

  const setSatelliteLocationId = useCallback((id: string) => {
    setCheckout((p) =>
      p.satelliteLocationId === id ? p : { ...p, satelliteLocationId: id },
    );
  }, []);

  const setDeliveryType = useCallback((t: DeliveryType) => {
    setCheckout((p) => ({
      ...p,
      deliveryType: t,
      ...(t === 'pickup'
        ? {
            deliveryFeeCents: 0,
            routeDistanceMeters: undefined,
            deliveryInServiceArea: undefined,
            locationConfirmed: true,
          }
        : { locationConfirmed: false }),
    }));
  }, []);

  const setScheduledDate = useCallback((d: string) => {
    setCheckout((p) => ({ ...p, scheduledDate: d }));
  }, []);

  const setScheduledTime = useCallback((t: string) => {
    setCheckout((p) => ({ ...p, scheduledTime: t }));
  }, []);

  const setAddress = useCallback((a: string) => {
    setCheckout((p) => ({ ...p, address: a }));
  }, []);

  const setAddressDetails = useCallback((details: Partial<CheckoutAddress>) => {
    setCheckout((p) => {
      const nextDetails = { ...p.addressDetails, ...details };
      const keys = Object.keys(details);
      const onlyCoordinates =
        keys.length > 0 &&
        keys.every((key) => LOCATION_METADATA_KEYS.has(key));
      if (onlyCoordinates) {
        return {
          ...p,
          addressDetails: nextDetails,
          locationConfirmed: false,
        };
      }
      // Campos que só anotam o endereço (não entram na cotação nem no pin):
      // atualiza sem invalidar a cotação/localização já confirmada.
      const annotationKeys = new Set([
        'neighborhood',
        'complement',
        'referencePoint',
      ]);
      const onlyAnnotations =
        keys.length > 0 && keys.every((key) => annotationKeys.has(key));
      if (onlyAnnotations) {
        return {
          ...p,
          addressDetails: nextDetails,
          address: formatAddressSummary(nextDetails),
        };
      }
      return {
        ...p,
        addressDetails: nextDetails,
        address: formatAddressSummary(nextDetails),
        routeDistanceMeters: undefined,
        deliveryFeeCents: 0,
        deliveryInServiceArea: undefined,
        deliveryQuoteSource: undefined,
        locationConfirmed: false,
      };
    });
  }, []);

  const setDeliveryQuote = useCallback(
    (quote: {
      routeDistanceMeters: number;
      deliveryFeeCents: number;
      inServiceArea: boolean;
      source: DeliveryQuoteSource;
      latitude: number;
      longitude: number;
      formattedAddress: string;
      locationConfirmed?: boolean;
    }) => {
      setCheckout((p) => ({
        ...p,
        routeDistanceMeters: quote.routeDistanceMeters,
        deliveryFeeCents: quote.deliveryFeeCents,
        deliveryInServiceArea: quote.inServiceArea,
        deliveryQuoteSource: quote.source,
        locationConfirmed: quote.locationConfirmed ?? false,
        addressDetails: {
          ...p.addressDetails,
          latitude: quote.latitude,
          longitude: quote.longitude,
          formattedAddress: quote.formattedAddress,
        },
        address: quote.formattedAddress || p.address,
      }));
    },
    [],
  );

  const clearDeliveryQuote = useCallback(() => {
    setCheckout((p) => ({
      ...p,
      routeDistanceMeters: undefined,
      deliveryFeeCents: 0,
      deliveryInServiceArea: undefined,
      deliveryQuoteSource: undefined,
      locationConfirmed: false,
    }));
  }, []);

  const setLocationConfirmed = useCallback((confirmed: boolean) => {
    setCheckout((p) => ({ ...p, locationConfirmed: confirmed }));
  }, []);

  const setPaymentMethod = useCallback((m: PaymentMethod) => {
    setCheckout((p) => ({ ...p, paymentMethod: m }));
  }, []);

  const setChangeFor = useCallback((c: string) => {
    setCheckout((p) => ({ ...p, changeFor: c }));
  }, []);

  const setNote = useCallback((n: string) => {
    setCheckout((p) => ({ ...p, note: n }));
  }, []);

  const resetCheckout = useCallback(() => {
    // Volta a fulfillmentLocation/prontaEntrega pro default — o efeito de
    // persistência acima já regrava esse default no localStorage a partir
    // daqui, não precisa limpar a chave manualmente.
    setCheckout(initialCheckoutState);
  }, []);

  const value = useMemo(
    () => ({
      checkout,
      setFulfillmentLocation,
      setSatelliteLocationId,
      setDeliveryType,
      setScheduledDate,
      setScheduledTime,
      setAddress,
      setAddressDetails,
      setDeliveryQuote,
      clearDeliveryQuote,
      setLocationConfirmed,
      setPaymentMethod,
      setChangeFor,
      setNote,
      resetCheckout,
    }),
    [
      checkout,
      setFulfillmentLocation,
      setSatelliteLocationId,
      setDeliveryType,
      setScheduledDate,
      setScheduledTime,
      setAddress,
      setAddressDetails,
      setDeliveryQuote,
      clearDeliveryQuote,
      setLocationConfirmed,
      setPaymentMethod,
      setChangeFor,
      setNote,
      resetCheckout,
    ],
  );

  return (
    <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>
  );
}

export function useCheckout() {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error('useCheckout must be within CheckoutProvider');
  return ctx;
}
