'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useCheckout } from '@/contexts/CheckoutContext';
import type { ValidationResult } from '@/app/checkout/recebimento/recebimento-helpers';

/**
 * Toda a lógica de "validar endereço e cotar a entrega": debounce nas
 * mudanças do formulário, chave de deduplicação, e revalidação a partir das
 * coordenadas do pino no mapa. `runValidation` é um useEffectEvent e só roda
 * de dentro de Effects — nunca direto de um handler.
 */
export function useDeliveryQuote() {
  const {
    checkout,
    setDeliveryQuote,
    clearDeliveryQuote,
    setAddressDetails,
    setLocationConfirmed,
  } = useCheckout();

  const details = checkout.addressDetails;
  const canQuote =
    checkout.deliveryType === 'delivery' &&
    details.street.trim().length > 1 &&
    details.number.trim().length > 0;

  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteMessage, setQuoteMessage] = useState<string | null>(null);

  const applyValidation = useEffectEvent((validation: ValidationResult) => {
    setQuoteMessage(validation.message ?? null);
    setDeliveryQuote({
      routeDistanceMeters: validation.routeDistanceMeters,
      deliveryFeeCents: validation.deliveryFeeCents,
      inServiceArea: validation.inServiceArea,
      source: validation.source,
      latitude: validation.latitude,
      longitude: validation.longitude,
      formattedAddress: validation.formattedAddress,
      locationConfirmed: false,
    });
  });

  const lastValidationKeyRef = useRef<string | null>(null);

  const buildValidationKey = useEffectEvent(
    (coords?: { latitude?: number; longitude?: number }) =>
      JSON.stringify({
        street: details.street.trim(),
        number: details.number.trim(),
        neighborhood: details.neighborhood.trim(),
        complement: details.complement.trim(),
        referencePoint: details.referencePoint.trim(),
        city: details.city || 'Pereiro',
        state: details.state || 'CE',
        postalCode: details.postalCode.trim(),
        latitude: coords?.latitude ?? details.latitude ?? null,
        longitude: coords?.longitude ?? details.longitude ?? null,
      }),
  );

  const runValidation = useEffectEvent(
    async (coords?: { latitude?: number; longitude?: number }) => {
      if (!canQuote) return;

      const validationKey = buildValidationKey(coords);
      if (validationKey === lastValidationKeyRef.current) return;
      lastValidationKeyRef.current = validationKey;

      setQuoting(true);
      setQuoteError(null);
      try {
        const response = await fetch('/api/v1/addresses/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            street: details.street,
            number: details.number,
            neighborhood: details.neighborhood,
            complement: details.complement || undefined,
            referencePoint: details.referencePoint || undefined,
            city: details.city || 'Pereiro',
            state: details.state || 'CE',
            postalCode: details.postalCode || undefined,
            latitude: coords?.latitude ?? details.latitude,
            longitude: coords?.longitude ?? details.longitude,
          }),
        });
        const json = await response.json();
        if (!response.ok) {
          lastValidationKeyRef.current = null;
          clearDeliveryQuote();
          setQuoteError(
            json?.error?.message ?? 'Não foi possível validar o endereço.',
          );
          return;
        }
        applyValidation(json.validation as ValidationResult);
      } catch {
        lastValidationKeyRef.current = null;
        clearDeliveryQuote();
        setQuoteError('Falha de rede ao validar o endereço.');
      } finally {
        setQuoting(false);
      }
    },
  );

  useEffect(() => {
    if (!canQuote) {
      lastValidationKeyRef.current = null;
      return;
    }

    const timer = window.setTimeout(() => {
      void runValidation();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    canQuote,
    details.street,
    details.number,
    details.city,
    details.state,
    details.postalCode,
  ]);

  const pendingCoordsRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [coordsRevalidateNonce, setCoordsRevalidateNonce] = useState(0);

  const revalidateWithCoords = (latitude: number, longitude: number) => {
    setAddressDetails({ latitude, longitude });
    setLocationConfirmed(false);
    pendingCoordsRef.current = { latitude, longitude };
    setCoordsRevalidateNonce((nonce) => nonce + 1);
  };

  // Dispara a validação a partir de coordenadas do mapa. Passa por um nonce
  // para que `runValidation` (useEffectEvent) só seja chamado de dentro de
  // um Effect — nunca direto do handler.
  useEffect(() => {
    if (coordsRevalidateNonce === 0) return;
    const timer = window.setTimeout(() => {
      const coords = pendingCoordsRef.current;
      if (coords) void runValidation(coords);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [coordsRevalidateNonce]);

  return { canQuote, quoting, quoteError, quoteMessage, revalidateWithCoords };
}
