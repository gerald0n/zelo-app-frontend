import type { Metadata, Viewport } from 'next';
import { Fraunces, Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import Providers from '@/components/Providers';
import './globals.css';

/** Display serif — títulos, preços, marca. */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

/** Sans de corpo e UI. */
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

/** Mono — dados tabulares (totais, horários, códigos). */
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

/**
 * A CSP com `nonce` (ver `src/proxy.ts`) exige renderização dinâmica: o nonce
 * é injetado nos scripts durante o SSR de cada request. Páginas estáticas
 * ficariam com scripts sem nonce e seriam bloqueadas. O app já é quase todo
 * dinâmico (dados no cliente via react-query, sem ISR), então o custo é baixo.
 */
export const dynamic = 'force-dynamic';

/**
 * Domínio de produção do app (o cardápio) — base para as URLs absolutas do
 * metadata (og:image, og:url etc.). É `cardapio.…`, não o apex, que hospeda
 * a landing em outro projeto.
 */
const SITE_URL = 'https://cardapio.zeloconfeitaria.com.br';
const SITE_TITLE = 'Zelo Confeitaria — Doces artesanais em Pereiro, CE';
const SITE_DESCRIPTION =
  'Cookies, pudins e salgados artesanais feitos com carinho em Pereiro, CE.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: 'Zelo',
  appleWebApp: {
    capable: true,
    title: 'Zelo',
    statusBarStyle: 'default',
  },
  // A imagem (og:image / twitter:image) vem de `opengraph-image.tsx` e
  // `twitter-image.tsx`, que o Next injeta automaticamente no <head>.
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Zelo Confeitaria',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Comportamento de app: sem pinch/double-tap zoom. Chrome (inclusive iOS)
  // respeita; Safari iOS ignora e é tratado por LockMobileZoom.
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#F7F1E6',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`bg-background ${fraunces.variable} ${geist.variable} ${geistMono.variable}`}
      // Chromium (e.g. Chrome autofill) may inject __gcrremoteframetoken before hydration.
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
