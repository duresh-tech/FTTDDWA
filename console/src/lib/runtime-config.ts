/**
 * Runtime configuration.
 *
 * `next build` string-replaces every `process.env.NEXT_PUBLIC_*` read into the
 * client bundles, which means a built Docker image is permanently pinned to
 * whatever API URL it was built with -- setting it via compose `environment:`
 * at run time does nothing. That makes one image per environment, and a wrong
 * value a rebuild rather than a restart.
 *
 * Instead, the server emits the real values at /runtime-config.js (see
 * src/app/runtime-config.js/route.ts), loaded with `beforeInteractive` so it
 * executes before any app bundle.
 *
 * Everything here must therefore be a LAZY getter, never a module-scope const:
 * these modules are also evaluated during SSR, where `window` does not exist.
 * On the server the process.env fallbacks apply, and they resolve to the same
 * container environment the route handler reads -- so SSR output and the
 * hydrated client agree.
 *
 * The NEXT_PUBLIC_* fallbacks keep host-native `npm run dev` working unchanged
 * with the existing .env.local.
 */

export interface RuntimeConfig {
  apiUrl: string;
  appName: string;
  osmTileUrl: string;
}

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: Partial<RuntimeConfig>;
  }
}

const FALLBACK: RuntimeConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "FTTDDWA",
  osmTileUrl:
    process.env.NEXT_PUBLIC_OSM_TILE_URL ??
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
};

function readConfig(): RuntimeConfig {
  // Never touch `window` during SSR.
  if (typeof window === "undefined") return FALLBACK;
  return { ...FALLBACK, ...(window.__RUNTIME_CONFIG__ ?? {}) };
}

/** Base URL of the versioned REST API, e.g. http://localhost:4000/api/v1 */
export function getApiUrl(): string {
  return readConfig().apiUrl;
}

/** Fallback application name. Prefer `useAppSettings()`, which reads the DB. */
export function getAppName(): string {
  return readConfig().appName;
}

export function getOsmTileUrl(): string {
  return readConfig().osmTileUrl;
}

/**
 * Origin the backend serves static /uploads files from: the API URL minus its
 * /api/vN suffix.
 */
export function getUploadsOrigin(): string {
  return getApiUrl().replace(/\/api\/v\d+\/?$/, "");
}

/** Absolute URL for a stored file path (as returned by the upload endpoints). */
export function uploadUrl(path: string): string {
  return `${getUploadsOrigin()}/uploads/${path}`;
}
