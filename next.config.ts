import type { NextConfig } from 'next';
import { networkInterfaces } from 'node:os';
import { withSentryConfig } from '@sentry/nextjs';
import { buildSecurityHeaders } from './src/config/security-headers';

function localLanHosts(): string[] {
  const hosts: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      hosts.push(entry.address);
    }
  }
  return hosts;
}

function lanDevOrigins(): string[] {
  const defaults = [
    '127.0.0.1',
    '192.168.0.5',
    '192.168.0.4',
    '192.168.200.206',
    ...localLanHosts(),
  ];
  const fromEnv = (process.env.DEV_LAN_HOST || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set([...defaults, ...fromEnv])];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: lanDevOrigins(),
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders(),
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

/**
 * Envolve o config com o plugin do Sentry só para:
 * - subir source maps no build (precisa de `SENTRY_AUTH_TOKEN` no ambiente de
 *   build da Vercel; sem token, o plugin só avisa e segue) e removê-los do
 *   bundle público;
 * - associar cada evento ao release / commit (via `VERCEL_GIT_COMMIT_SHA`);
 * - tunelar os eventos por `/monitoring` (mesma origem) driblando ad-blockers.
 *
 * A instrumentação de runtime continua nos `sentry.*.config.ts` +
 * `instrumentation.ts` + init lazy no `Providers.tsx` — não é o wizard.
 */
export default withSentryConfig(nextConfig, {
  org: 'zelo-confeitaria',
  project: 'zelo-app',
  silent: !process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
  tunnelRoute: '/monitoring',
  widenClientFileUpload: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
