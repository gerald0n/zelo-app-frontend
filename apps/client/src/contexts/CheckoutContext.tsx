'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { DeliveryQuoteSource } from '@/modules/delivery';

export type DeliveryType = 'delivery' | 'pickup';
export type ScheduleType = 'now' | 'scheduled';
export type PaymentMethod = 'pix' | 'cash' | 'card';

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
  formattedAddress?: string;
};

export type CheckoutState = {
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

type CheckoutContextType = {
  checkout: CheckoutState;
  setDeliveryType: (t: DeliveryType) => void;
  setScheduleType: (t: ScheduleType) => void;
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

const emptyAddress: CheckoutAddress = {
  street: '',
  number: '',
  neighborhood: '',
  complement: '',
  referencePoint: '',
  city: 'Pereiro',
  state: 'CE',
  postalCode: '',
};

const initial: CheckoutState = {
  deliveryType: 'delivery',
  scheduleType: 'now',
  address: '',
  addressDetails: emptyAddress,
  deliveryFeeCents: 0,
  locationConfirmed: false,
  paymentMethod: 'pix',
  changeFor: '',
  note: '',
};

function formatAddressSummary(details: CheckoutAddress): string {
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

const CheckoutContext = createContext<CheckoutContextType | null>(null);

export function CheckoutProvider({ children }: { children: React.ReactNode }) {
  const [checkout, setCheckout] = useState<CheckoutState>(initial);

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

  const setScheduleType = useCallback((t: ScheduleType) => {
    setCheckout((p) => ({ ...p, scheduleType: t }));
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
        keys.every((key) => key === 'latitude' || key === 'longitude');
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
    setCheckout(initial);
  }, []);

  const value = useMemo(
    () => ({
      checkout,
      setDeliveryType,
      setScheduleType,
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
      setDeliveryType,
      setScheduleType,
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
