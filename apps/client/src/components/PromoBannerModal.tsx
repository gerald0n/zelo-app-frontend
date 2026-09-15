'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { X } from 'lucide-react';
import {
  isPromoBannerBlockedPath,
  markPromoBannerShown,
  PROMO_BANNER_CATEGORY_HREF,
  wasPromoBannerShownThisSession,
} from '@/lib/promo-banner';

const BANNER_ALT = 'Esfirras disponíveis no nosso cardápio';

/**
 * Banner promocional fixo (hardcoded), exibido uma vez por sessão ao abrir
 * o app — arte horizontal no desktop, vertical no mobile via CSS.
 */
export function PromoBannerModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isPromoBannerBlockedPath(pathname)) return;
    if (wasPromoBannerShownThisSession()) return;

    markPromoBannerShown();
    // Abre ao montar (1x por sessão) — não sincroniza com nada externo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [pathname]);

  if (!open) return null;

  const close = () => setOpen(false);

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-foreground/50 p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={BANNER_ALT}
        className="relative z-10 w-full max-w-[280px] overflow-hidden rounded-2xl bg-card shadow-2xl sm:max-w-2xl"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-20 flex size-8 items-center justify-center rounded-full bg-foreground/60 text-background hover:bg-foreground/80"
        >
          <X className="size-[18px]" />
        </button>

        <Link href={PROMO_BANNER_CATEGORY_HREF} onClick={close} className="block">
          <Image
            src="/promo/banner-vertical.png"
            alt={BANNER_ALT}
            width={941}
            height={1672}
            className="block w-full sm:hidden"
            priority
          />
          <Image
            src="/promo/banner-horizontal.png"
            alt={BANNER_ALT}
            width={1672}
            height={941}
            className="hidden w-full sm:block"
            priority
          />
        </Link>
      </div>
    </div>
  );
}
