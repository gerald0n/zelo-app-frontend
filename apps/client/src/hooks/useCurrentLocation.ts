'use client';

import { useEffect, useRef, useState } from 'react';
import {
  fetchAddressFromCoordinates,
  type ReverseGeocodedAddress,
} from '@/modules/delivery/places';
import { LOW_GPS_ACCURACY_METERS } from '@/modules/delivery/geo';

type LocationStatus = 'idle' | 'locating' | 'error';

export type CurrentLocationResult = {
  latitude: number;
  longitude: number;
  accuracy: number;
  /** `null` quando o reverse geocode falha/não acha nada — GPS continua válido. */
  address: ReverseGeocodedAddress | null;
};

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 0,
};

function messageForGeolocationError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Permissão de localização negada. Você pode digitar o endereço manualmente.';
    case error.POSITION_UNAVAILABLE:
      return 'Não foi possível obter sua localização agora.';
    case error.TIMEOUT:
      return 'A localização demorou demais para responder. Tente de novo.';
    default:
      return 'Não foi possível obter sua localização agora.';
  }
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      GEOLOCATION_OPTIONS,
    );
  });
}

/**
 * GPS do navegador + reverse geocode pra sugerir rua/número/bairro. O
 * sucesso NUNCA depende do reverse geocode: se ele falhar ou não achar
 * endereço nenhum, a coordenada continua válida (`address: null` +
 * `infoMessage` avisando, não `errorMessage`).
 */
export function useCurrentLocation() {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const supported =
    typeof navigator !== 'undefined' && 'geolocation' in navigator;

  async function locate(): Promise<CurrentLocationResult | null> {
    if (!supported || status === 'locating') return null;

    setStatus('locating');
    setErrorMessage(null);
    setInfoMessage(null);

    let position: GeolocationPosition;
    try {
      position = await getCurrentPosition();
    } catch (cause) {
      setStatus('error');
      setErrorMessage(messageForGeolocationError(cause as GeolocationPositionError));
      return null;
    }

    const { latitude, longitude, accuracy } = position.coords;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const address = await fetchAddressFromCoordinates(
      latitude,
      longitude,
      controller.signal,
    );

    setStatus('idle');
    if (!address || (!address.street && !address.formattedAddress)) {
      setInfoMessage(
        'Localização obtida, mas não conseguimos identificar a rua automaticamente. Você pode preencher o endereço ou só ajustar o pin no mapa.',
      );
    } else if (accuracy > LOW_GPS_ACCURACY_METERS) {
      setInfoMessage(
        `Localização com precisão baixa (~${Math.round(accuracy)}m) — confira se o pin está no lugar certo.`,
      );
    }

    return { latitude, longitude, accuracy, address };
  }

  return { status, errorMessage, infoMessage, supported, locate };
}
