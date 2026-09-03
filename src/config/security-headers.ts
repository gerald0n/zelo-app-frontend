/**
 * Cabeçalhos de segurança.
 *
 * - `buildSecurityHeaders()` (sem CSP) é aplicado a todas as rotas via
 *   `next.config.ts`.
 * - A `Content-Security-Policy` é emitida pelo `src/proxy.ts` a cada request,
 *   com um `nonce` único, para dispensar `script-src 'unsafe-inline'` em
 *   produção. `buildContentSecurityPolicy(nonce)` monta a policy.
 */

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
  // Acesso pela LAN (`DEV_LAN_HOST=192.168.x.x pnpm dev`): o navegador do
  // outro dispositivo fala com o Supabase e o HMR pelo IP da máquina.
  ...(process.env.DEV_LAN_HOST
    ? [
        `http://${process.env.DEV_LAN_HOST}:54321`,
        `ws://${process.env.DEV_LAN_HOST}:54321`,
        `ws://${process.env.DEV_LAN_HOST}:3000`,
      ]
    : []),
];

/**
 * Monta a `Content-Security-Policy`.
 *
 * Com `nonce`, o `script-src` usa `'nonce-<...>' 'strict-dynamic'` e dispensa
 * `'unsafe-inline'` (o Next injeta o nonce nos próprios scripts; scripts de
 * terceiros carregados por um script confiável — ex.: Turnstile — herdam a
 * confiança via `strict-dynamic`). Sem `nonce` (fallback para rotas que o
 * proxy não cobre, como assets estáticos), cai no `'unsafe-inline'`.
 */
export function buildContentSecurityPolicy(nonce?: string): string {
  const production = !isRelaxedEnv();

  // `unsafe-eval` só é necessário para o React Refresh do `next dev`.
  const scriptSrc = nonce
    ? [
        "script-src 'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        production ? null : "'unsafe-eval'",
      ].filter(Boolean)
    : [
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
    // Atributos `style=` do React exigem `'unsafe-inline'` em `style-src`;
    // injeção de estilo não executa script, então o risco residual é baixo.
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

  return csp.join('; ');
}

/** Cabeçalhos fixos (sem CSP) — aplicados a todas as rotas via next.config. */
export function buildSecurityHeaders(): Header[] {
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=()',
    },
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    },
  ];
}
