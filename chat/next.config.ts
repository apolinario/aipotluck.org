import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

// Optional path-mount: when APP_BASE_PATH is set (e.g. "/chat"), the whole app
// serves under that prefix so it can be proxied at a path of another domain
// (aipotluck.org/chat). With basePath set and no custom assetPrefix, Next serves
// assets under `${basePath}/_next`, so a SINGLE upstream rewrite
// (`/chat/* -> chat-app/chat/*`) covers pages, assets, and API in one rule.
// Unset = serves at root (local dev, standalone preview). Deliberately separate
// from IS_DEMO, which independently toggles the full-gateway model list in
// /api/models — a path mount must not flip model behavior.
const basePath = process.env.APP_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  ...(basePath
    ? {
        basePath,
        redirects: async () => [
          {
            source: "/",
            destination: basePath,
            permanent: false,
            basePath: false,
          },
        ],
      }
    : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    // Mirror the served model id to the client so provenance derives from it.
    NEXT_PUBLIC_MODEL_ID:
      process.env.HF_MODEL ?? "swiss-ai/Apertus-70B-Instruct-2509",
  },
  // Baseline HTTP security headers (the chat shipped none). Each holds under
  // full transparency — friction even when the attacker knows the setup, no
  // security-through-obscurity. The CSP is deliberately limited to directives
  // that don't restrict scripts/styles, so it can't break Next's inline
  // hydration bootstrap; a nonce-based script-src CSP is a separate follow-up.
  // Permissions-Policy locks mic/camera/geo — revisit when the Voice capability
  // (currently an open invitation on the map) actually ships.
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "Content-Security-Policy",
          value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
        },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ],
    },
  ],
  // Pin the workspace root — this app is nested in the aipotluck.org repo
  // beside a Python root + the Vite app/, so auto-detection picks the wrong
  // lockfile. Anchor it here.
  turbopack: {
    root: import.meta.dirname,
  },
  cacheComponents: true,
  devIndicators: false,
  poweredByHeader: false,
  reactCompiler: true,
  logging: {
    fetches: {
      fullUrl: false,
    },
    incomingRequests: false,
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  experimental: {
    prefetchInlining: true,
    cachedNavigations: true,
    appNewScrollHandler: true,
    inlineCss: true,
    // (Persistent dev FS cache left at its default-off — the template's `true`
    // did 10-21s cache writes on this machine's slow filesystem, stalling
    // first compile. Omitted rather than set false, which Next flags.)
  },
};

export default withBotId(nextConfig);
