import type { Metadata, Viewport } from 'next';
import { Fraunces, Geist, Geist_Mono } from 'next/font/google';
import AdminProviders from '@/components/AdminProviders';
import './globals.css';

/** Display serif — títulos, marca. */
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
 * é injetado nos scripts durante o SSR de cada request.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Painel · Zelo Confeitaria',
  description: 'Painel administrativo da Zelo Confeitaria.',
  applicationName: 'Zelo Admin',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AdminProviders>{children}</AdminProviders>
      </body>
    </html>
  );
}
