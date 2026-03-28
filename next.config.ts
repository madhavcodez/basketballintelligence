import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    staticGenerationRetryCount: 0,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.nba.com',
        pathname: '/headshots/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.nba.com',
        pathname: '/logos/**',
      },
    ],
  },
};

export default nextConfig;
