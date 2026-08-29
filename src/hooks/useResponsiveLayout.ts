'use client';

import { useEffect, useState } from 'react';

function getLayout(width: number, height: number) {
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const isWideDesktop = width >= 1440;
  const isLandscape = width > height;

  return {
    width,
    height,
    isTablet,
    isDesktop,
    isWideDesktop,
    isLandscape,
    showSideCategories: isDesktop || (isTablet && isLandscape),
    showPersistentCart: isDesktop || (isTablet && isLandscape && width >= 900),
  };
}

/** SSR + first client paint: mobile. Real viewport applied after mount. */
const SSR_LAYOUT = getLayout(0, 0);

export function useResponsiveLayout() {
  const [layout, setLayout] = useState(SSR_LAYOUT);

  useEffect(() => {
    const update = () =>
      setLayout(getLayout(window.innerWidth, window.innerHeight));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return layout;
}
