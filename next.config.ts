import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Pin the workspace root: a stray lockfile higher up the tree must not change module resolution.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
