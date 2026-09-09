import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Fraunces, Geist, Geist_Mono } from 'next/font/google';
import AdminProviders from '@/components/AdminProviders';
import './globals.css';

/**
 * Aplica `.dark` no `<html>` antes da 1ª pintura, lendo a mesma chave que o
 * `useThemeToggle` persiste. Sem isso, o tema escuro pisca de claro a cada
 * carregamento (o 1º render usa o fallback `light` e só o effect corrige).
 * Só `'dark'` escurece — qualquer outro valor é claro, igual ao hook.
 */
const THEME_SCRIPT =
  "try{if(localStorage.getItem('zelo:theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // O `nonce` da CSP (ver `src/proxy.ts`) — sem ele o script inline é barrado.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang="pt-BR"
      className={`bg-background ${fraunces.variable} ${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* `<script>` cru (não `next/script`): precisa ser um script inline
            síncrono no HTML do SSR, que roda antes da 1ª pintura.
            `next/script beforeInteractive` empurraria isto para o runtime do
            cliente e o flash voltaria. O aviso de dev "script tag while
            rendering" é esperado (só em dev) e o comportamento está certo. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AdminProviders>{children}</AdminProviders>
      </body>
    </html>
  );
}
