import type { NextConfig } from 'next';
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

export default nextConfig;
