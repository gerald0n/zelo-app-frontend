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
    ];
  },
};

/**
 * Mesma configuração de Sentry da app da loja, projeto próprio (`zelo-admin`).
 * Sem `SENTRY_AUTH_TOKEN` no build, o plugin só avisa e segue.
 */
export default withSentryConfig(nextConfig, {
  org: 'zelo-confeitaria',
  project: 'zelo-admin',
  silent: !process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
  tunnelRoute: '/monitoring',
  widenClientFileUpload: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
