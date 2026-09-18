import type { Metadata, Viewport } from 'next';
import {
  Caveat,
  Fraunces,
  Geist,
  Geist_Mono,
  Inter,
  Nunito,
  Playfair_Display,
} from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import Providers from '@/components/Providers';
import { getCachedPublicStore } from '@/modules/catalog/cached-catalog';
import { buildThemeStyle } from '@/modules/catalog/theme-style';
import { buildFontStyle } from '@/modules/catalog/font-style';
import './globals.css';

/** Display serif — títulos, preços, marca. Preset padrão ('zelo'). */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

/** Sans de corpo e UI. Preset padrão ('zelo'). */
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

/** Mono — dados tabulares (totais, horários, códigos). Não varia por preset. */
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

/**
 * Fontes por tenant (ADR-0001, Fase D — `font-presets.ts`). Todas
 * pré-importadas: `next/font/google` exige import estático, então não dá
 * pra escolher a fonte em runtime — só qual variável fica ativa
 * (`font-style.ts`). O download real do arquivo de fonte só acontece se o
 * preset da loja realmente usar essa variável (comportamento padrão do
 * navegador para `@font-face` não referenciado por nenhum elemento visível).
 */
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat',
  display: 'swap',
});
const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
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
const FALLBACK_STORE_NAME = 'Zelo Confeitaria';
const FALLBACK_TITLE = 'Zelo Confeitaria — Doces artesanais em Pereiro, CE';
const SITE_DESCRIPTION =
  'Cookies, pudins e salgados artesanais feitos com carinho em Pereiro, CE.';

/**
 * White label (ADR-0001, Fase D) — nome/título passam a vir de `stores.name`
 * quando a loja resolve; sem loja (erro/loja não encontrada), mantém o
 * fallback da Zelo — zero mudança de comportamento nesse caso.
 */
export async function generateMetadata(): Promise<Metadata> {
  const store = await getCachedPublicStore();
  const storeName = store.ok ? store.data?.name : undefined;
  const title = storeName
    ? `${storeName} — Doces artesanais em Pereiro, CE`
    : FALLBACK_TITLE;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description: SITE_DESCRIPTION,
    applicationName: storeName ?? 'Zelo',
    appleWebApp: {
      capable: true,
      title: storeName ?? 'Zelo',
      statusBarStyle: 'default',
    },
    // A imagem (og:image / twitter:image) vem de `opengraph-image.tsx` e
    // `twitter-image.tsx`, que o Next injeta automaticamente no <head>.
    openGraph: {
      type: 'website',
      url: SITE_URL,
      siteName: storeName ?? FALLBACK_STORE_NAME,
      title,
      description: SITE_DESCRIPTION,
      locale: 'pt_BR',
    },
    twitter: {
      card: 'summary_large_image',
      title,
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
}

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const store = await getCachedPublicStore();
  const themeStyle = buildThemeStyle(store.ok ? store.data?.theme : undefined);
  const fontStyle = buildFontStyle(store.ok ? store.data?.fontConfig : undefined);

  return (
    <html
      lang="pt-BR"
      className={`bg-background ${fraunces.variable} ${geist.variable} ${geistMono.variable} ${playfair.variable} ${inter.variable} ${caveat.variable} ${nunito.variable}`}
      // Chromium (e.g. Chrome autofill) may inject __gcrremoteframetoken before hydration.
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        {themeStyle && <style>{themeStyle}</style>}
        {fontStyle && <style>{fontStyle}</style>}
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
