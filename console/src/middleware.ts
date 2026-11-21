import { NextResponse, type NextRequest } from "next/server";

/**
 * The dev-mode stand-in for the nginx gateway.
 *
 * In Docker the gateway serves the console and forwards /api and /uploads to
 * the API. `npm run dev` has no gateway, so this forwards the same two paths
 * to API_PROXY_TARGET — which is what lets a tenant business domain such as
 * http://acme.localhost:3000 work locally exactly as it does behind the
 * gateway, with the browser always calling its own origin.
 *
 * It does NOT add the API key: `lib/console-key.ts` puts that on every
 * request from the client side, so there is one mechanism in both
 * environments and nothing proxy-shaped to keep in step.
 *
 * This lives here rather than in `next.config.ts` because a rewrite there
 * cannot be made conditional on anything useful, and middleware is where Next
 * expects request-level proxying. Production returns immediately: in the
 * container nginx owns these paths and Next never sees them.
 */
export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.next();

  const target = process.env.API_PROXY_TARGET ?? "http://localhost:4000";
  return NextResponse.rewrite(
    new URL(request.nextUrl.pathname + request.nextUrl.search, target),
  );
}

export const config = {
  // getUploadsOrigin() resolves to "" from a relative APP_API_URL, so
  // uploadUrl() produces /uploads/<path> - which needs forwarding too.
  matcher: ["/api/:path*", "/uploads/:path*"],
};
