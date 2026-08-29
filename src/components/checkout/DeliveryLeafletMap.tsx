'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { distanceMeters } from '@/lib/geo/distance-meters';

const IDLE_DEBOUNCE_MS = 280;
const MIN_MOVE_METERS = 8;

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

type DeliveryLeafletMapProps = {
  latitude: number;
  longitude: number;
  onReady?: () => void;
  onError?: (message: string) => void;
  onCenterChange?: (latitude: number, longitude: number) => void;
};

export function DeliveryLeafletMap({
  latitude,
  longitude,
  onReady,
  onError,
  onCenterChange,
}: DeliveryLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const interactingRef = useRef(false);
  const lastEmittedRef = useRef({ latitude, longitude });
  const idleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    lastEmittedRef.current = { latitude, longitude };
  }, [latitude, longitude]);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let map: LeafletMap | null = null;

    void (async () => {
      try {
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');

        if (cancelled || !containerRef.current) return;

        map = L.map(containerRef.current, {
          center: [latitude, longitude],
          zoom: 17,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: OSM_ATTRIBUTION,
          maxZoom: 19,
        }).addTo(map);

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
          const next = {
            latitude: center.lat,
            longitude: center.lng,
          };
          const prev = lastEmittedRef.current;
          if (distanceMeters(prev, next) < MIN_MOVE_METERS) return;

          lastEmittedRef.current = next;
          onCenterChange(next.latitude, next.longitude);
        };

        map.on('dragstart', () => {
          interactingRef.current = true;
        });
        map.on('dragend', () => {
          interactingRef.current = false;
          clearIdleTimer();
          idleTimerRef.current = window.setTimeout(
            emitCenterIfMoved,
            IDLE_DEBOUNCE_MS,
          );
        });

        map.whenReady(() => {
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
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init map once per mount
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || interactingRef.current) return;

    const center = map.getCenter();
    const delta = distanceMeters(
      { latitude, longitude },
      { latitude: center.lat, longitude: center.lng },
    );
    if (delta < MIN_MOVE_METERS) return;

    lastEmittedRef.current = { latitude, longitude };
    map.panTo([latitude, longitude]);
  }, [latitude, longitude]);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
}
