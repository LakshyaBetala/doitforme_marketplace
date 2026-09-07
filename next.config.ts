import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Fix: tells Next.js this project is the root, ignoring the parent lockfile
  outputFileTracingRoot: path.join(__dirname),

  // Keep browser-only and build-only packages out of the server bundle.
  //
  // A Cloudflare Worker has a hard compressed-size ceiling and everything Next
  // traces ends up inside it. Tracing was carrying 22MB that can never run
  // there: onnxruntime-node (per-platform .node native binaries),
  // @xenova/transformers (browser-only, see the externals block below) and
  // babel-plugin-react-compiler (build time only). Harmless on a Node server
  // too — it was just dead weight.
  outputFileTracingExcludes: {
    '**/*': [
      './node_modules/onnxruntime-node/**',
      './node_modules/@xenova/**',
      './node_modules/babel-plugin-react-compiler/**',
    ],
  },
  // Security headers. None of these were being sent — not on Cloudflare and not
  // on Vercel before it; nothing in this config ever set them.
  //
  // The one that matters most here is frame-ancestors. Without it any site can
  // put /activity or /gig/<id> in an invisible iframe over their own UI and
  // harvest the click that releases escrow. On a product whose core action is
  // "approve and release the money", clickjacking is not theoretical.
  //
  // Referrer-Policy is the second: resume links are 5-minute signed URLs and gig
  // pages carry ids. A full Referer header hands those to every third-party
  // asset the next page loads.
  //
  // A full Content-Security-Policy is deliberately NOT set. This app loads
  // Razorpay checkout, Supabase, Google Fonts and the Xenova model files from
  // several origins, and a wrong script-src silently breaks payments — which is
  // worse than the header being absent. frame-ancestors is the one CSP
  // directive that carries no such risk, so it ships alone until a full policy
  // can be worked out against the real origin list.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // 2 years, preload-eligible. Cloudflare terminates TLS for every
          // route now, so there is no plain-HTTP path left to break.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Nothing in the product uses these. Camera stays allowed on self
          // because ID and gig-image upload can come straight from a phone.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
    ]
  },
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
    // The framework image optimizer is OFF.
    //
    // On Vercel Hobby it was burning Image Optimization transformations (4K/5K)
    // and Fast Origin Transfer to re-encode images that Supabase already serves
    // from its own CDN. Since uploads are compressed client-side to <=1600px
    // (lib/imageCompress.ts), there is little left to optimise.
    //
    // On Cloudflare the calculus changes — wrangler.jsonc binds Cloudflare
    // Images, which is a separate allowance from Workers requests — so this is
    // worth revisiting once the migration is proven. Left off for now so the
    // cutover changes one thing at a time; remotePatterns is kept for that day.
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
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharptools": false,
      "onnxruntime-node": false,
    };

    if (isServer) {
      // Resolve @xenova/transformers to an empty object in the SERVER bundle.
      //
      // This has to go through `externals`, not `resolve.alias`. Next marks ESM
      // node_modules as external for the server build, and webpack settles
      // externals during `factorize`, which runs BEFORE alias resolution — so
      // every alias form is silently ignored (verified: aliasing the package
      // name, the local wrapper, and the resolved absolute path all left the
      // output unchanged) and the package comes out as a passthrough
      // `import("@xenova/transformers")`. OpenNext then has to follow that into
      // onnxruntime-node's per-platform `.node` native binaries and @xenova's
      // bundled copy of sharp, neither of which esbuild can load, and the
      // Worker build fails with "No loader is configured for .node files".
      //
      // An externals FUNCTION placed first in the array wins: webpack takes the
      // first entry that returns a result, so Next's own ~75 handlers never see
      // the request. `var {}` inlines an empty object instead of emitting an
      // import, which drops the package from the graph entirely.
      //
      // Safe because nothing server-side calls it. The sole reference is
      // lib/transformersLoader.ts, reached only from useModeration's
      // loadModel(), which runs from a browser event handler and never during
      // render. The browser build is untouched and still bundles the real
      // library.
      const existing = config.externals;
      config.externals = [
        (
          { request }: { request?: string },
          callback: (err?: unknown, result?: string) => void
        ) => {
          if (request === "@xenova/transformers") return callback(undefined, "var {}");
          return callback();
        },
        ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
      ];
    }

    return config;
  },
  turbopack: {}
};

export default nextConfig;

// Gives `next dev` access to Cloudflare bindings (env, caches) so local
// development matches the deployed Worker. No-ops outside dev.
import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
