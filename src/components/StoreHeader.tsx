'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Clock, Info, MapPin, ShoppingBag } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useStoreHoursLabel, useStoreOpen } from '@/hooks/useStoreOpen';
import { getAppScroller, getAppScrollTop } from '@/lib/layout';
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

/** Mesmo vidro dos filtros sticky em HomeCatalog. */
const STICKY_SURFACE_CLASS = 'bg-background/90 backdrop-blur';

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
      y: getAppScrollTop(getAppScroller()),
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
      const y = getAppScrollTop(getAppScroller());
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
    // Desktop rola em `window`; mobile no container `[data-app-scroll]`.
    // Ouve os dois — o que não rola simplesmente nunca dispara.
    window.addEventListener('scroll', onScroll, { passive: true });
    const shellScroller = document.querySelector('[data-app-scroll]');
    shellScroller?.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      shellScroller?.removeEventListener('scroll', onScroll);
    };
  }, []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!visible || !pinned || !panel) return;

    animRef.current?.cancel();

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
        className="pointer-events-none fixed inset-x-0 top-0 z-[45] pt-[env(safe-area-inset-top,0px)]"
        aria-hidden={!pinned}
      >
        <div className="pointer-events-none mx-auto w-full max-w-md lg:max-w-none">
          <div
            ref={panelRef}
            role="banner"
            className={cn(
              'pointer-events-auto border-b border-border/50 px-4 py-1.5',
              STICKY_SURFACE_CLASS,
              pinned ? 'pointer-events-auto' : 'pointer-events-none',
            )}
            style={{
              transform: `translate3d(0, -${STORE_HEADER_COMPACT_HEIGHT}px, 0)`,
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
    <div>
      <div
        ref={heroRef}
        className="border-b border-border/50 bg-background/90 px-4 pb-2.5 pt-3 backdrop-blur-md"
      >
        <HeroContent
          storeOpen={storeOpen}
          hoursLabel={hoursLabel}
          totalItems={totalItems}
          expanded
        />
      </div>

      {portalReady && compactBar ? createPortal(compactBar, document.body) : null}
    </div>
  );
}

function HeroContent({
  expanded,
  storeOpen,
  hoursLabel,
  totalItems,
}: {
  expanded: boolean;
  storeOpen: boolean;
  hoursLabel: string;
  totalItems: number;
}) {
  return (
    <div className="flex items-start justify-between gap-2.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <div
          className={cn(
            'flex shrink-0 items-center justify-center bg-primary text-primary-foreground',
            expanded ? 'size-11 rounded-xl' : 'size-8 rounded-lg',
          )}
        >
          <span
            className={cn(
              'font-serif font-semibold',
              expanded ? 'text-xl' : 'text-base',
            )}
          >
            Z
          </span>
        </div>

        <div className="min-w-0 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1
              className={cn(
                'font-serif font-semibold leading-none text-foreground',
                expanded ? 'text-lg' : 'text-sm',
              )}
            >
              {expanded ? 'Zelo Confeitaria' : 'Zelo'}
            </h1>
            <StatusBadge storeOpen={storeOpen} compact={!expanded} />
          </div>

          <p
            className={cn(
              'flex items-center gap-1 overflow-hidden whitespace-nowrap text-muted-foreground',
              expanded ? 'mt-1 text-xs' : 'mt-0.5 text-2xs',
            )}
          >
            <MapPin
              className={cn('shrink-0', expanded ? 'size-3' : 'size-2.5')}
              aria-hidden="true"
            />
            <span className="shrink-0">Pereiro, CE</span>
            {expanded ? (
              <>
                <span className="shrink-0 text-muted-foreground/50" aria-hidden="true">
                  ·
                </span>
                <span className="truncate">Entrega e retirada</span>
              </>
            ) : null}
          </p>

          {expanded ? (
            <div className="mt-1.5">
              <p className="text-xs leading-snug text-muted-foreground">
                Cookies, pudins e salgados artesanais
              </p>
              <p className="mt-1 flex items-center gap-1.5 overflow-hidden text-2xs font-medium whitespace-nowrap text-foreground/80">
                <Clock className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{hoursLabel}</span>
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <HeaderActions expanded={expanded} totalItems={totalItems} />
    </div>
  );
}

function StatusBadge({
  storeOpen,
  compact,
}: {
  storeOpen: boolean;
  compact: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        storeOpen
          ? 'bg-pistachio/60 text-pistachio-foreground'
          : 'bg-destructive/15 text-destructive',
        compact ? 'px-1.5 py-0.5 text-2xs' : 'px-1.5 py-0.5 text-2xs',
      )}
    >
      <span
        className={cn(
          'rounded-full',
          storeOpen ? 'bg-pistachio-foreground' : 'bg-destructive',
          compact ? 'size-1' : 'size-1.5',
        )}
      />
      {storeOpen ? 'Aberto agora' : 'Fechado'}
    </span>
  );
}

function HeaderActions({
  expanded,
  totalItems,
}: {
  expanded: boolean;
  totalItems: number;
}) {
  const iconBtn = expanded ? 'size-9' : 'size-8';
  const iconSize = expanded ? 'size-4' : 'size-3.5';

  return (
    <div className={cn('flex shrink-0 items-center gap-1.5', expanded && 'mt-0.5')}>
      <Link
        href="/loja"
        aria-label="Informações da loja"
        className={cn(
          'flex items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-accent',
          iconBtn,
        )}
      >
        <Info className={iconSize} />
      </Link>
      <Link
        href="/carrinho"
        aria-label={totalItems > 0 ? `Sacola, ${totalItems} itens` : 'Sacola'}
        className={cn(
          'relative flex items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-accent',
          iconBtn,
        )}
      >
        <ShoppingBag className={iconSize} />
        {totalItems > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground">
            {totalItems}
          </span>
        ) : null}
      </Link>
    </div>
  );
}
