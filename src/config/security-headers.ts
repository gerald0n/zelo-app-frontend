/** Headers aplicados em todas as rotas via next.config. */

type Header = { key: string; value: string };

/**
 * CSP relaxada só quando o app fala com o Supabase local: `next dev`, ou um
 * `next build`/`next start` marcado como `APP_ENV=local`. Preview, produção e
 * qualquer build sem `APP_ENV` recebem a CSP estrita (Supabase hospedado).
 */
function isRelaxedEnv(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.APP_ENV === 'local' ||
    process.env.NEXT_PUBLIC_APP_ENV === 'local'
  );
}

/** Origens externas usadas pelo app em qualquer ambiente. */
const CONNECT_SRC_BASE = [
  'https://*.supabase.co',
  'wss://*.supabase.co',
  'https://challenges.cloudflare.com',
  'https://nominatim.openstreetmap.org',
  'https://*.tile.openstreetmap.org',
  'https://tile.openstreetmap.org',
  'https://router.project-osrm.org',
  'https://*.ingest.sentry.io',
  'https://*.sentry.io',
  'https://maps.googleapis.com',
];

/** Supabase local + HMR do Next — só em desenvolvimento. */
const CONNECT_SRC_DEV = [
  'http://127.0.0.1:54321',
  'ws://127.0.0.1:54321',
  'ws://127.0.0.1:3000',
  'http://localhost:54321',
  'ws://localhost:54321',
  'ws://localhost:3000',
];

export function buildSecurityHeaders(): Header[] {
  const production = !isRelaxedEnv();

  // `unsafe-eval` só é necessário para o React Refresh do `next dev`.
  const scriptSrc = [
    "script-src 'self'",
    "'unsafe-inline'",
    production ? null : "'unsafe-eval'",
    'https://challenges.cloudflare.com',
  ].filter(Boolean);

  const connectSrc = [
    "connect-src 'self'",
    ...(production ? [] : CONNECT_SRC_DEV),
    ...CONNECT_SRC_BASE,
  ];

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    scriptSrc.join(' '),
    "style-src 'self' 'unsafe-inline'",
    production
      ? "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org https://tile.openstreetmap.org"
      : "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    connectSrc.join(' '),
    'frame-src https://challenges.cloudflare.com https://www.openstreetmap.org',
    // Só em produção: em `next dev` sobre http, esta diretiva quebra o
    // carregamento dos chunks (`_next/static/*`) forçando https local inexistente.
    production ? 'upgrade-insecure-requests' : null,
  ].filter(Boolean);

  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=()',
    },
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    },
    { key: 'Content-Security-Policy', value: csp.join('; ') },
  ];
}
