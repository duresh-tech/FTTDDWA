/**
 * Serves the browser the configuration this container was started with.
 *
 * Loaded from the root layout with `beforeInteractive`, so it runs before any
 * app bundle and src/lib/runtime-config.ts can read window.__RUNTIME_CONFIG__.
 *
 * This is what makes one built image runnable in any environment: the values
 * below are read per request from the server's environment instead of being
 * inlined into the client bundles at build time.
 */

// Both are mandatory. Without them Next statically generates this route at
// build time and bakes in the build-time environment -- silently restoring the
// exact problem this file exists to solve.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const config = {
    // APP_API_URL must be reachable FROM THE BROWSER (e.g.
    // http://localhost:4000/api/v1), never a compose service name like
    // http://backend:4000 -- service DNS only resolves container-to-container.
    apiUrl:
      process.env.APP_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://localhost:4000/api/v1",
    appName:
      process.env.APP_NAME ?? process.env.NEXT_PUBLIC_APP_NAME ?? "FTTDDWA",
    osmTileUrl:
      process.env.APP_OSM_TILE_URL ??
      process.env.NEXT_PUBLIC_OSM_TILE_URL ??
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  };

  return new Response(
    `window.__RUNTIME_CONFIG__=${JSON.stringify(config)};`,
    {
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
