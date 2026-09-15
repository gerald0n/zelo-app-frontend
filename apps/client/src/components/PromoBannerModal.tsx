'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { buildSupportWhatsappLink } from '@/lib/support-whatsapp';
import {
  isPromoBannerBlockedPath,
  markPromoBannerShown,
  wasPromoBannerShownThisSession,
} from '@/lib/promo-banner';

const BANNER_ALT = 'Esfirras disponíveis no nosso cardápio';
const WHATSAPP_MESSAGE =
  'Olá! Vi o banner de esfirras e quero fazer uma reserva.';
const DEFAULT_RESERVE_HREF = '/loja';

/**
 * Banner promocional fixo (hardcoded), exibido uma vez por sessão ao abrir
 * o app — arte horizontal no desktop, vertical no mobile via CSS.
 */
export function PromoBannerModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [reserveHref, setReserveHref] = useState(DEFAULT_RESERVE_HREF);

  useEffect(() => {
    if (isPromoBannerBlockedPath(pathname)) return;
    if (wasPromoBannerShownThisSession()) return;

    markPromoBannerShown();
    // Abre ao montar (1x por sessão) — não sincroniza com nada externo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    let active = true;

    void buildSupportWhatsappLink(WHATSAPP_MESSAGE).then((link) => {
      if (active && link) setReserveHref(link);
    });

    return () => {
      active = false;
    };
  }, [open]);

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
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-2xl sm:max-w-2xl"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-20 flex size-8 items-center justify-center rounded-full bg-foreground/60 text-background hover:bg-foreground/80"
        >
          <X className="size-[18px]" />
        </button>

        <a
          href={reserveHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
          className="block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG local; o otimizador do next/image não processa SVG. */}
          <img
            src="/promo/esfirras-banner-mobile.svg"
            alt={BANNER_ALT}
            className="block w-full sm:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG local; o otimizador do next/image não processa SVG. */}
          <img
            src="/promo/esfirras-banner-desktop.svg"
            alt={BANNER_ALT}
            className="hidden w-full sm:block"
          />
        </a>
      </div>
    </div>
  );
}
