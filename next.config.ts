import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  output: "standalone",
};

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    // LLM API responses are dynamic and must never be cached.
    // Non-LLM API requests use NetworkFirst so they stay fresh online but
    // still serve a cached copy when offline.
    runtimeCaching: [
      {
        // LLM endpoints: mistake analysis, similar-question generation,
        // knowledge tree/content generation, LLM health check.
        // NetworkOnly => never read from or write to cache.
        urlPattern:
          /^https?:\/\/[^/]+\/api\/(mistakes\/analyze|mistakes\/[^/]+\/similar-questions|knowledge\/tree|knowledge\/[^/]+\/(practice|examples|intro|detail)|health)([/?].*)?$/,
        handler: "NetworkOnly",
      },
      {
        // Other same-origin API requests: NetworkFirst with offline fallback.
        urlPattern: /^https?:\/\/[^/]+\/api\/.*$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-cache",
          networkTimeoutSeconds: 10,
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 60 * 60, // 1 hour
          },
        },
      },
      {
        // App shell: hashed static assets under /_next/static (JS/CSS chunks).
        // These are content-addressed, so Cache-First is safe and fastest.
        urlPattern: /\/_next\/static\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static-cache",
          expiration: {
            maxEntries: 256,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
        },
      },
      {
        // Static assets: images, fonts, audio, video (same origin).
        urlPattern: /\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff|woff2|ttf|eot|otf)$/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-asset-cache",
          expiration: {
            maxEntries: 128,
            maxAgeSeconds: 60 * 60 * 24 * 14, // 14 days
          },
        },
      },
      {
        // Document (HTML) requests: NetworkFirst so users get fresh content
        // when online, with a cached shell fallback when offline.
        urlPattern: /^https?:\/\/[^/]+\/.*$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "html-cache",
          networkTimeoutSeconds: 10,
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 60 * 60 * 24, // 1 day
          },
        },
      },
    ],
  },
});

export default withPWA(nextConfig);
