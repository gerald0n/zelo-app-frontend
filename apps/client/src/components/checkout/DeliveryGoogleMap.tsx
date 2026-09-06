/// <reference types="google.maps" />
'use client';

import { useEffect, useRef } from 'react';
import { distanceMeters } from '@/lib/geo/distance-meters';
import { loadGoogleMaps } from '@/modules/delivery/google-maps-loader';

const IDLE_DEBOUNCE_MS = 280;
const MIN_MOVE_METERS = 8;

type DeliveryGoogleMapProps = {
  latitude: number;
  longitude: number;
  onReady?: () => void;
  onError?: (message: string) => void;
  onCenterChange?: (latitude: number, longitude: number) => void;
};

export function DeliveryGoogleMap({
  latitude,
  longitude,
  onReady,
  onError,
  onCenterChange,
}: DeliveryGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const interactingRef = useRef(false);
  const lastEmittedRef = useRef({ latitude, longitude });
  const idleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    lastEmittedRef.current = { latitude, longitude };
  }, [latitude, longitude]);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let map: google.maps.Map | null = null;
    const listeners: google.maps.MapsEventListener[] = [];

    void (async () => {
      try {
        const g = await loadGoogleMaps();
        if (cancelled || !containerRef.current) return;

        map = new g.maps.Map(containerRef.current, {
          center: { lat: latitude, lng: longitude },
          zoom: 19,
          mapTypeId: g.maps.MapTypeId.HYBRID,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
        });

        mapRef.current = map;

        const clearIdleTimer = () => {
          if (idleTimerRef.current != null) {
            window.clearTimeout(idleTimerRef.current);
            idleTimerRef.current = null;
          }
        };

        const emitCenterIfMoved = () => {
          if (!onCenterChange || !map) return;
          const center = map.getCenter();
          if (!center) return;
          const next = { latitude: center.lat(), longitude: center.lng() };
          const prev = lastEmittedRef.current;
          if (distanceMeters(prev, next) < MIN_MOVE_METERS) return;

          lastEmittedRef.current = next;
          onCenterChange(next.latitude, next.longitude);
        };

        listeners.push(
          map.addListener('dragstart', () => {
            interactingRef.current = true;
          }),
        );
        listeners.push(
          map.addListener('dragend', () => {
            interactingRef.current = false;
            clearIdleTimer();
            idleTimerRef.current = window.setTimeout(
              emitCenterIfMoved,
              IDLE_DEBOUNCE_MS,
            );
          }),
        );

        g.maps.event.addListenerOnce(map, 'idle', () => {
          if (!cancelled) onReady?.();
        });
      } catch (error: unknown) {
        if (cancelled) return;
        onError?.(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o mapa.',
        );
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(idleTimerRef.current ?? undefined);
      idleTimerRef.current = null;
      listeners.forEach((listener) => listener.remove());
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init map once per mount
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || interactingRef.current) return;

    const center = map.getCenter();
    if (!center) return;
    const delta = distanceMeters(
      { latitude, longitude },
      { latitude: center.lat(), longitude: center.lng() },
    );
    if (delta < MIN_MOVE_METERS) return;

    lastEmittedRef.current = { latitude, longitude };
    map.panTo({ lat: latitude, lng: longitude });
  }, [latitude, longitude]);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0" data-map-container />
  );
}
