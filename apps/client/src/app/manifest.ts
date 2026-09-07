import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zelo Confeitaria',
    short_name: 'Zelo',
    description:
      'Cookies, pudins e salgados artesanais feitos com carinho em Pereiro, CE.',
    start_url: '/',
    id: '/',
    display: 'standalone',
    display_override: ['standalone', 'browser'],
    background_color: '#F7F1E6',
    theme_color: '#F7F1E6',
    lang: 'pt-BR',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
