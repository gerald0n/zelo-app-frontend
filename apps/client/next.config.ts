import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import { lanDevOrigins } from '../../packages/shared/src/config/dev-lan-origins';
import { buildSecurityHeaders } from '../../packages/shared/src/config/security-headers';

const nextConfig: NextConfig = {
  allowedDevOrigins: lanDevOrigins(),
  poweredByHeader: false,
  transpilePackages: ['@zelo/shared'],
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
