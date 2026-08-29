import type { NextConfig } from 'next';
import { networkInterfaces } from 'node:os';
import { SECURITY_HEADERS } from './src/config/security-headers';

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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
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

export default nextConfig;
