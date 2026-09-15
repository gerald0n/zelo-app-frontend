'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { CatalogBanner } from '@/modules/catalog/types';

const AUTO_MS = 4000;

type Slide = {
  id: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  linkHref?: string | null;
};

/** Sem banner cadastrado (Configurações → Marketing), cai nesses 3 slides fixos. */
const FALLBACK_SLIDES: Slide[] = [
  {
    id: 'feito',
    eyebrow: 'Feito com carinho',
    title: 'Doces artesanais para o seu momento',
  },
  {
    id: 'fresquinho',
    eyebrow: 'Fresquinho todo dia',
    title: 'Sabores que chegam quentinhos até você',
  },
  {
    id: 'encomendas',
    eyebrow: 'Encomendas especiais',
    title: 'Celebre com a Zelo Confeitaria',
  },
];

function bannersToSlides(banners: CatalogBanner[]): Slide[] {
  return banners.map((banner) => ({
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle ?? undefined,
    imageUrl: banner.imageUrl,
    linkHref: banner.linkHref,
  }));
}

export default function MenuHeroCarousel({
  banners = [],
}: {
  banners?: CatalogBanner[];
}) {
  const slides = banners.length > 0 ? bannersToSlides(banners) : FALLBACK_SLIDES;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const ignoreScrollRef = useRef(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const goTo = (index: number, behavior: ScrollBehavior = 'smooth') => {
    const el = scrollerRef.current;
    if (!el) return;
    const slide = el.children[index] as HTMLElement | undefined;
    if (!slide) return;
    ignoreScrollRef.current = true;
    el.scrollTo({ left: slide.offsetLeft - el.offsetLeft, behavior });
    setActive(index);
    window.setTimeout(
      () => {
        ignoreScrollRef.current = false;
      },
      behavior === 'smooth' ? 450 : 0,
    );
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => {
      if (ignoreScrollRef.current) return;
      const slideEls = Array.from(el.children) as HTMLElement[];
      if (slideEls.length === 0) return;
      const mid = el.scrollLeft + el.clientWidth / 2;
      let closest = 0;
      let closestDist = Infinity;
      slideEls.forEach((slide, index) => {
        const center = slide.offsetLeft - el.offsetLeft + slide.clientWidth / 2;
        const dist = Math.abs(mid - center);
        if (dist < closestDist) {
          closestDist = dist;
          closest = index;
        }
      });
      setActive(closest);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const id = window.setInterval(() => {
      const next = (activeRef.current + 1) % slides.length;
      goTo(next);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [paused, slides.length]);

  return (
    <section className="px-4 pt-3" aria-label="Destaque">
      <div className="relative">
        <div
          ref={scrollerRef}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-2xl"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerCancel={() => setPaused(false)}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          {slides.map((slide) => {
            const content = (
              <>
                {slide.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.imageUrl}
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <>
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-caramel/20 blur-2xl"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -bottom-16 -left-8 size-40 rounded-full bg-pistachio/15 blur-2xl"
                    />
                  </>
                )}
                {slide.imageUrl ? (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent"
                  />
                ) : null}
                {slide.eyebrow ? (
                  <p className="relative text-2xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
                    {slide.eyebrow}
                  </p>
                ) : null}
                <h2 className="relative mt-2 max-w-[16ch] text-balance font-serif text-2xl font-semibold leading-tight text-primary-foreground">
                  {slide.title}
                </h2>
                {slide.subtitle ? (
                  <p className="relative mt-1 max-w-[28ch] text-sm text-primary-foreground/85">
                    {slide.subtitle}
                  </p>
                ) : null}
              </>
            );

            const className = cn(
              'relative min-w-full shrink-0 snap-center overflow-hidden bg-primary px-4 pb-10 pt-5 lg:min-h-[420px] lg:px-8 lg:pb-14 lg:pt-8',
              !slide.imageUrl && 'text-primary-foreground',
            );

            return slide.linkHref ? (
              <Link key={slide.id} href={slide.linkHref} className={className}>
                {content}
              </Link>
            ) : (
              <article key={slide.id} className={className}>
                {content}
              </article>
            );
          })}
        </div>

        {slides.length > 1 ? (
          <div
            className="absolute inset-x-0 bottom-3.5 z-10 flex items-center justify-start gap-1.5 px-4"
            role="tablist"
            aria-label="Slides do destaque"
          >
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-label={`Ir para slide ${index + 1}`}
                onClick={() => {
                  setPaused(true);
                  goTo(index);
                  window.setTimeout(() => setPaused(false), AUTO_MS);
                }}
                className={cn(
                  'size-2 rounded-full transition-colors duration-300',
                  index === active
                    ? 'bg-primary-foreground'
                    : 'bg-primary-foreground/40 hover:bg-primary-foreground/70',
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
