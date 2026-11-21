import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

// The dev-mode reverse proxy that used to live here (a rewrite of /api and
// /uploads to API_PROXY_TARGET) now lives in src/middleware.ts.
//
// It had to move: the API requires an x-api-key header on every call, and a
// rewrite cannot add a REQUEST header - only middleware can. Keeping a rewrite
// as well would be a second, conflicting path to the same place.
const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker runtime image. Note that
  // .next/static is NOT included in standalone output and must be copied
  // separately -- see the Dockerfile.
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
