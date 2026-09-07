'use client';

import { useEffect, useState } from 'react';

/*
 * Um único conjunto de limiares, alinhado com os breakpoints do Tailwind
 * (`md` 768, `lg` 1024). Use este hook só para lógica que precisa mesmo de
 * JavaScript (contadores, medições); **estrutura de layout deve ser CSS**
 * (`lg:` / `md:`), senão o primeiro paint sai como mobile e "pula" para o
 * desktop depois da montagem.
 */
type Layout = {
  width: number;
  isTablet: boolean;
  isDesktop: boolean;
};

/** SSR + primeiro paint no cliente: mobile. Viewport real aplicado após montar. */
const SSR_LAYOUT: Layout = { width: 0, isTablet: false, isDesktop: false };

export function useResponsiveLayout(): Layout {
  const [layout, setLayout] = useState<Layout>(SSR_LAYOUT);

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      setLayout({
        width,
        isTablet: width >= 768,
        isDesktop: width >= 1024,
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return layout;
}
