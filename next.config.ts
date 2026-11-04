import type { NextConfig } from 'next';

// Standalone keeps the production Docker image minimal and independent of
// a third-party hosting runtime. API routes remain available on Dell.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
};
export default nextConfig;
