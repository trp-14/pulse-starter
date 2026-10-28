import path from 'node:path';
import type { NextConfig } from 'next';
import { STATIC_SECURITY_HEADERS } from './lib/security/headers';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Pin the workspace root: a stray lockfile higher up the tree must not change module resolution.
  turbopack: { root: path.resolve(__dirname) },
  async headers() {
    return [
      { source: '/:path*', headers: [...STATIC_SECURITY_HEADERS] },
      // API responses are never cached anywhere (route handlers also set this explicitly).
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};

export default nextConfig;
