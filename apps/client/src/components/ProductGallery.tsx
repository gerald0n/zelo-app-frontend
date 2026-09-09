'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductThumb } from '@/components/product-thumb';
import { categoryTone } from '@/modules/catalog/types';
import { cn } from '@/lib/utils';

type GalleryImage = { url: string; alt: string | null };

type Props = {
  images: GalleryImage[];
  productName: string;
  productSlug: string;
};

/**
 * Fotos do produto na página de detalhe. Uma foto (ou nenhuma) → cai no
 * `ProductThumb` de sempre. Duas ou mais → carrossel com swipe + indicadores,
 * e setas no desktop.
 */
export default function ProductGallery({
  images,
  productName,
  productSlug,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const slideWidth = el.clientWidth || 1;
      setActive(Math.round(el.scrollLeft / slideWidth));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  if (images.length <= 1) {
    return (
      <ProductThumb
        tone={categoryTone(productSlug)}
        src={images[0]?.url ?? null}
        alt={images[0]?.alt ?? productName}
        className="h-full w-full rounded-none"
        iconClassName="size-16"
        width={860}
      />
    );
  }

  const goTo = (index: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(images.length - 1, index));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="relative h-full w-full">
      <div
        ref={scrollerRef}
        className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((image, index) => (
          <div
            key={image.url}
            className="relative h-full w-full shrink-0 snap-center"
          >
            <ProductThumb
              tone={categoryTone(productSlug)}
              src={image.url}
              alt={image.alt ?? `${productName} — foto ${index + 1}`}
              className="h-full w-full rounded-none"
              iconClassName="size-16"
              width={860}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label="Foto anterior"
        onClick={() => goTo(active - 1)}
        disabled={active === 0}
        className="absolute left-2 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 shadow-sm backdrop-blur transition disabled:opacity-0 lg:flex"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        aria-label="Próxima foto"
        onClick={() => goTo(active + 1)}
        disabled={active === images.length - 1}
        className="absolute right-2 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 shadow-sm backdrop-blur transition disabled:opacity-0 lg:flex"
      >
        <ChevronRight className="size-5" />
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
        {images.map((image, index) => (
          <span
            key={image.url}
            className={cn(
              'size-1.5 rounded-full transition-colors duration-300',
              index === active ? 'bg-foreground' : 'bg-foreground/30',
            )}
          />
        ))}
      </div>
    </div>
  );
}
