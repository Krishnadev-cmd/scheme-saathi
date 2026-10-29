import type { NextConfig } from "next";

const isProd = (process.env.APP_ENV || process.env.NODE_ENV) === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS only makes sense once the site is served over https.
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const onVercel = !!process.env.VERCEL;

const nextConfig: NextConfig = {
  // Self-contained server bundle for Docker / `npm start`. Vercel packages the app itself.
  ...(onVercel ? {} : { output: "standalone" as const }),
  poweredByHeader: false,
  // Node built-in (local SQLite) and the Postgres driver are loaded at runtime, not bundled.
  serverExternalPackages: ["node:sqlite", "postgres"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
