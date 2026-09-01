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
    // Vercel's image optimizer is OFF.
    //
    // On Hobby it was burning Image Optimization transformations (4K/5K) and
    // Fast Origin Transfer to re-encode images that Supabase already serves
    // from its own CDN. Since uploads are now compressed client-side to
    // <=1600px (lib/imageCompress.ts), there is little left to optimise — so
    // this moves that bandwidth off Vercel's exhausted quota and onto Supabase
    // egress, which is at ~1GB of 5GB.
    //
    // Cost: no automatic WebP conversion or responsive srcset. Flip back to
    // false on a paid plan; remotePatterns below is kept for that day.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wxjurdywtkkyybgbpgzx.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      // Google OAuth profile photos (lh3, and the lh1-lh6 variants).
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
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