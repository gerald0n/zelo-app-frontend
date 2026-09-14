'use client';

import { useRef, useState } from 'react';
import type { CurrentLocationResult } from '@/hooks/useCurrentLocation';
import type { ResolvedPlace } from '@/modules/delivery/places';
import {
  PIN_DIVERGENCE_METERS,
  haversineDistanceMeters,
  type LocationSource,
} from '@/modules/delivery/geo';

type Coords = { latitude: number; longitude: number };

type AddressFields = {
  street: string;
  number: string;
  neighborhood: string;
  setStreet: (value: string) => void;
  setNumber: (value: string) => void;
  setNeighborhood: (value: string) => void;
};

/**
 * Estado e handlers de "de onde veio essa coordenada" (autocomplete/geocode,
 * GPS, pin arrastado) — mesma lógica que `DeliveryAddressSection` usa no
 * checkout, isolada aqui em hook porque `AccountAddressForm` já carrega
 * bastante estado próprio do formulário.
 */
export function useAddressLocation(
  fields: AddressFields,
  initialCoords: Coords | null,
) {
  const [placeCoords, setPlaceCoords] = useState<Coords | null>(
    initialCoords,
  );
  const [locationSource, setLocationSource] = useState<
    LocationSource | undefined
  >(undefined);
  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState<
    number | undefined
  >(undefined);
  const [locationDiverged, setLocationDiverged] = useState(false);
  const highConfidenceOriginRef = useRef<Coords | null>(null);

  function resetLocation() {
    setPlaceCoords(null);
    setLocationSource(undefined);
    setLocationAccuracyMeters(undefined);
    setLocationDiverged(false);
  }

  // Pin do mapa arrastado: guarda a coordenada; o efeito de cotação do
  // formulário re-valida com ela.
  function handleCenterChange(latitude: number, longitude: number) {
    const diverged = highConfidenceOriginRef.current
      ? haversineDistanceMeters(highConfidenceOriginRef.current, {
          latitude,
          longitude,
        }) > PIN_DIVERGENCE_METERS
      : false;
    setLocationSource('manual_pin');
    setLocationAccuracyMeters(undefined);
    setLocationDiverged(diverged);
    setPlaceCoords({ latitude, longitude });
  }

  function handleResolvedPlace(place: ResolvedPlace) {
    const latitude = Number.isFinite(place.latitude)
      ? place.latitude
      : undefined;
    const longitude = Number.isFinite(place.longitude)
      ? place.longitude
      : undefined;
    if (latitude != null && longitude != null) {
      highConfidenceOriginRef.current = { latitude, longitude };
    }
    fields.setStreet(place.street || fields.street);
    if (place.number) fields.setNumber(place.number);
    if (place.neighborhood) fields.setNeighborhood(place.neighborhood);
    setLocationSource('geocoded');
    setLocationAccuracyMeters(undefined);
    setLocationDiverged(false);
    setPlaceCoords(
      latitude != null && longitude != null ? { latitude, longitude } : null,
    );
  }

  function handleCurrentLocation(result: CurrentLocationResult) {
    if (result.accuracy <= PIN_DIVERGENCE_METERS) {
      highConfidenceOriginRef.current = {
        latitude: result.latitude,
        longitude: result.longitude,
      };
    } else {
      highConfidenceOriginRef.current = null;
    }
    // Preserva o que o cliente já digitou — o reverse geocode do GPS só
    // preenche o que ainda está vazio.
    if (!fields.street && result.address?.street) {
      fields.setStreet(result.address.street);
    }
    if (!fields.number && result.address?.number) {
      fields.setNumber(result.address.number);
    }
    if (!fields.neighborhood && result.address?.neighborhood) {
      fields.setNeighborhood(result.address.neighborhood);
    }
    setLocationSource('current_location');
    setLocationAccuracyMeters(result.accuracy);
    setLocationDiverged(false);
    setPlaceCoords({ latitude: result.latitude, longitude: result.longitude });
  }

  return {
    placeCoords,
    locationSource,
    locationAccuracyMeters,
    locationDiverged,
    resetLocation,
    handleCenterChange,
    handleResolvedPlace,
    handleCurrentLocation,
  };
}
