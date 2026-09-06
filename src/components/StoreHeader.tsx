'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCart } from '@/contexts/CartContext';
import { useStoreHoursLabel, useStoreOpen } from '@/hooks/useStoreOpen';
import { HeroContent } from '@/components/store-header/HeroContent';
import { cn } from '@/lib/utils';

const DRAWER_MS = 320;
const DRAWER_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
/** Mostra a barra compacta logo no início do scroll (não espera o hero sumir). */
const PIN_AT = 12;
const UNPIN_AT = 4;
/** Scroll rápido ou já avançado → encaixa sem animação drawer. */
const FAST_SCROLL_VELOCITY = 0.65;
const SNAP_OPEN_SCROLL_Y = 36;

export const STORE_HEADER_COMPACT_HEIGHT = 52;

/**
 * Superfície do cabeçalho: cor sólida, sem alpha e sem `backdrop-filter`.
 * Ao rolar, o conteúdo tem que sumir por completo atrás dele — nada de
 * "fantasma" borrado, inclusive na faixa da status bar/notch no PWA.
 */
const STICKY_SURFACE_CLASS = 'bg-background';

type Props = {
  onHeightChange?: (height: number) => void;
};

export default function StoreHeader({ onHeightChange }: Props) {
  const heroRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(false);
  const animRef = useRef<Animation | null>(null);
  const openPendingRef = useRef(false);
  const snapOpenRef = useRef(false);
  const scrollSampleRef = useRef({ y: 0, t: 0 });

  const [pinned, setPinned] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  /** Barra compacta no DOM (portal). */
  const [visible, setVisible] = useState(false);

  const storeOpen = useStoreOpen();
  const hoursLabel = useStoreHoursLabel();
  const { totalItems } = useCart();

  useEffect(() => {
    onHeightChange?.(STORE_HEADER_COMPACT_HEIGHT);
  }, [onHeightChange]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!heroRef.current) return;

    scrollSampleRef.current = {
      y: window.scrollY,
      t: performance.now(),
    };

    const applyPinned = (next: boolean, scrollY: number, velocity: number) => {
      if (next === pinnedRef.current) return;
      pinnedRef.current = next;

      if (next) {
        const fast =
          Math.abs(velocity) >= FAST_SCROLL_VELOCITY ||
          scrollY >= SNAP_OPEN_SCROLL_Y;
        snapOpenRef.current = fast;
        openPendingRef.current = !fast;
        setVisible(true);
      }

      setPinned(next);
    };

    const onScroll = () => {
      const y = window.scrollY;
      const t = performance.now();
      const { y: prevY, t: prevT } = scrollSampleRef.current;
      const dt = Math.max(t - prevT, 1);
      const velocity = (y - prevY) / dt;
      scrollSampleRef.current = { y, t };

      const prev = pinnedRef.current;
      if (!prev && y >= PIN_AT) {
        applyPinned(true, y, velocity);
        return;
      }
      if (prev && y <= UNPIN_AT) {
        applyPinned(false, y, velocity);
      }
    };

    onScroll();
    // Scroll normal do documento (sem app shell).
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!visible || !pinned || !panel) return;

    animRef.current?.cancel();

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const snap = snapOpenRef.current || reduced;

    if (snap) {
      snapOpenRef.current = false;
      openPendingRef.current = false;
      panel.style.transform = 'translate3d(0, 0, 0)';
      panel.style.opacity = '1';
      return;
    }

    if (!openPendingRef.current) return;

    openPendingRef.current = false;

    const slide = panel.offsetHeight || STORE_HEADER_COMPACT_HEIGHT;

    animRef.current = panel.animate(
      [
        {
          transform: `translate3d(0, -${slide}px, 0)`,
          opacity: 0,
        },
        {
          transform: 'translate3d(0, 0, 0)',
          opacity: 1,
        },
      ],
      { duration: DRAWER_MS, easing: DRAWER_EASING, fill: 'forwards' },
    );
  }, [visible, pinned]);

  useEffect(() => {
    if (pinned || !visible) return;

    const panel = panelRef.current;
    if (!panel) {
      setVisible(false);
      return;
    }

    animRef.current?.cancel();

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reduced) {
      setVisible(false);
      return;
    }

    const slide = panel.offsetHeight || STORE_HEADER_COMPACT_HEIGHT;

    const anim = panel.animate(
      [
        {
          transform: 'translate3d(0, 0, 0)',
          opacity: 1,
        },
        {
          transform: `translate3d(0, -${slide}px, 0)`,
          opacity: 0,
        },
      ],
      { duration: DRAWER_MS, easing: DRAWER_EASING, fill: 'forwards' },
    );

    animRef.current = anim;
    anim.onfinish = () => setVisible(false);

    return () => {
      anim.cancel();
    };
  }, [pinned, visible]);

  const compactBar =
    visible && portalReady ? (
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[45] lg:hidden"
        aria-hidden={!pinned}
      >
        <div className="pointer-events-none mx-auto w-full max-w-md lg:max-w-none">
          <div
            ref={panelRef}
            role="banner"
            className={cn(
              // O padding do topo cobre a área segura (status bar / notch) no
              // PWA instalado — a cor sólida começa em y=0 e nada aparece por
              // cima da barra ao rolar.
              'border-b border-border/50 px-4 pb-1.5 pt-[max(0.375rem,env(safe-area-inset-top,0px))]',
              STICKY_SURFACE_CLASS,
              pinned ? 'pointer-events-auto' : 'pointer-events-none',
            )}
            style={{
              transform: 'translate3d(0, -100%, 0)',
              opacity: 0,
            }}
          >
            <HeroContent
              storeOpen={storeOpen}
              hoursLabel={hoursLabel}
              totalItems={totalItems}
              expanded={false}
            />
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div className="lg:hidden">
      <div
        ref={heroRef}
        className="border-b border-border/50 bg-background px-4 pb-2.5 pt-[max(0.75rem,env(safe-area-inset-top,0px))]"
      >
        <HeroContent
          storeOpen={storeOpen}
          hoursLabel={hoursLabel}
          totalItems={totalItems}
          expanded
        />
      </div>

      {portalReady && compactBar
        ? createPortal(compactBar, document.body)
        : null}
    </div>
  );
}

