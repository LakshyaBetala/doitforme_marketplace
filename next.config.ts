import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Fix: tells Next.js this project is the root, ignoring the parent lockfile
  outputFileTracingRoot: path.join(__dirname),
  async redirects() {
    return [
      {
        source: '/marketplace/:path*',
        destination: 'https://marketforme.in/marketplace/:path*',
        permanent: true,
      },
      {
        source: '/store/:path*',
        destination: 'https://marketforme.in/store/:path*',
        permanent: true,
      },
      {
        source: '/marketplace',
        destination: 'https://marketforme.in',
        permanent: true,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wxjurdywtkkyybgbpgzx.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  serverExternalPackages: ['@xenova/transformers'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharptools": false,
      "onnxruntime-node": false,
    };
    return config;
  },
  turbopack: {}
};

export default nextConfig;