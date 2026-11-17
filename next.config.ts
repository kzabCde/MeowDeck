import type { NextConfig } from 'next';

/**
 * The existing P1/P3 headless engine intentionally uses NodeNext `.js`
 * specifiers in TypeScript source (e.g. './cards.js' -> './cards.ts').
 * Next.js 16 Turbopack does not yet universally support webpack-style
 * extensionAlias for this layout; use Next's supported Webpack mode until
 * the migration is runtime-tested with Turbopack.
 * This does not introduce another frontend framework or duplicate the engine.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack(config) {
    config.resolve ??= {};
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs']
    };
    return config;
  }
};

export default nextConfig;
