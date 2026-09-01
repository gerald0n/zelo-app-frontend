'use client';

import { useEffect } from 'react';

const MOBILE_QUERY = '(max-width: 1023px)';

function isMapTarget(target: EventTarget | null) {
  return (
    target instanceof Element && Boolean(target.closest('.leaflet-container'))
  );
}

/**
 * Reforça o bloqueio de zoom só no mobile — o Safari iOS ignora
 * `user-scalable=no` do <meta viewport>. Desktop mantém zoom normal.
 * O mapa de entrega (Leaflet) continua com pinch-zoom próprio.
 */
export default function LockMobileZoom() {
  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);

    const preventGesture = (event: Event) => {
      if (!media.matches || isMapTarget(event.target)) return;
      event.preventDefault();
    };

    const preventMultiTouch = (event: TouchEvent) => {
      if (
        !media.matches ||
        event.touches.length < 2 ||
        isMapTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
    };

    document.addEventListener('gesturestart', preventGesture);
    document.addEventListener('gesturechange', preventGesture);
    document.addEventListener('gestureend', preventGesture);
    document.addEventListener('touchmove', preventMultiTouch, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('gestureend', preventGesture);
      document.removeEventListener('touchmove', preventMultiTouch);
    };
  }, []);

  return null;
}
