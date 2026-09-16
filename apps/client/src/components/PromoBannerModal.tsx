'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { X } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { catalogKeys } from '@/lib/query-keys';
import {
  isPromoBannerBlockedPath,
  markPromoBannerShown,
  PROMO_BANNER_CATEGORY_HREF,
  wasPromoBannerShownThisSession,
} from '@/lib/promo-banner';

const FALLBACK_ALT = 'Esfirras disponíveis no nosso cardápio';
/**
 * Campanha padrão (fallback) — mesma arte de antes de virar configurável em
 * Configurações → Marketing, usada só quando não há campanha ativa dentro
 * da vigência (mesmo padrão de `FALLBACK_SLIDES` em `MenuHeroCarousel.tsx`).
 */
const FALLBACK_BANNER = {
  alt: FALLBACK_ALT,
  linkHref: PROMO_BANNER_CATEGORY_HREF,
  imageUrlVertical: '/promo/banner-vertical.png',
  imageUrlHorizontal: '/promo/banner-horizontal.png',
};

type PromoModalBanner = {
  id: string;
  title: string | null;
  linkHref: string | null;
  imageUrlVertical: string;
  imageUrlHorizontal: string;
};

/**
 * Banner modal de campanha, exibido uma vez por sessão ao abrir o app —
 * arte horizontal no desktop, vertical no mobile via CSS. Conteúdo vem de
 * Configurações → Marketing; sem campanha ativa, cai no banner padrão.
 */
export function PromoBannerModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const bannerQuery = useQuery({
    queryKey: catalogKeys.promoModalBanners(),
    queryFn: () =>
      apiJson<{ banners: PromoModalBanner[] }>(
        '/api/v1/catalog/promo-modal-banners',
      ),
  });
  const active = bannerQuery.data?.banners[0];
  const banner = active
    ? {
        alt: active.title ?? FALLBACK_ALT,
        linkHref: active.linkHref,
        imageUrlVertical: active.imageUrlVertical,
        imageUrlHorizontal: active.imageUrlHorizontal,
      }
    : FALLBACK_BANNER;

  useEffect(() => {
    if (isPromoBannerBlockedPath(pathname)) return;
    if (wasPromoBannerShownThisSession()) return;
    // Espera a query resolver (sucesso ou erro) pra decidir entre a
    // campanha configurada e o fallback, evitando abrir com o fallback e
    // trocar de imagem no meio da exibição.
    if (bannerQuery.isLoading) return;

    markPromoBannerShown();
    // Abre ao montar (1x por sessão) — não sincroniza com nada externo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [pathname, bannerQuery.isLoading]);

  // Trava o scroll da página por trás enquanto o modal estiver aberto.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const close = () => setOpen(false);

  const bannerLink = banner.linkHref;

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
        aria-label={banner.alt}
        className="relative z-10 w-[88vw] max-w-[380px] overflow-hidden rounded-2xl bg-card shadow-2xl sm:w-full sm:max-w-2xl"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-20 flex size-8 items-center justify-center rounded-full bg-foreground/60 text-background hover:bg-foreground/80"
        >
          <X className="size-[18px]" />
        </button>

        {(() => {
          const images = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={banner.imageUrlVertical}
                alt={banner.alt}
                className="block w-full sm:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={banner.imageUrlHorizontal}
                alt={banner.alt}
                className="hidden w-full sm:block"
              />
            </>
          );
          return bannerLink ? (
            <Link href={bannerLink} onClick={close} className="block">
              {images}
            </Link>
          ) : (
            <div className="block">{images}</div>
          );
        })()}
      </div>
    </div>
  );
}
