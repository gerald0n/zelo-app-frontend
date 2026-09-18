import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import GestorProviders from '@/components/GestorProviders';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

/**
 * A CSP com `nonce` (ver `src/proxy.ts`) exige renderização dinâmica.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Gestor · Zelo Platform',
  description: 'Gerenciamento de lojas (tenants) da plataforma.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`bg-background ${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <GestorProviders>{children}</GestorProviders>
      </body>
    </html>
  );
}
