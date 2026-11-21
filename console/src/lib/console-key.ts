import { fetchSetupStatus } from "@/lib/setup-status";

/**
 * The console's own API key, for the `x-api-key` header.
 *
 * Every API route requires a key — the guard fails closed — and the console is
 * an ordinary client of the API. The setup wizard issues this one and stores
 * it encrypted; `GET /system/setup/status` serves it back at run time, so
 * there is no env var to keep in step, nothing to inject at the proxy, and a
 * reissued key is picked up on the next page load without a rebuild.
 *
 * It rides on the setup-status request that the console already makes, so this
 * costs no extra round trip.
 *
 * See docs/guide/api-keys.
 */
export async function consoleApiKey(): Promise<string | null> {
  try {
    return (await fetchSetupStatus()).consoleApiKey ?? null;
  } catch {
    // Unreachable API, or a status call that failed. Returning null lets the
    // real request proceed and produce the real error, rather than masking a
    // network fault as a missing key.
    return null;
  }
}

/**
 * Adds `x-api-key` to a header set, when there is a key to add.
 *
 * Omitted rather than sent empty when there is none, so the failure is the
 * API's own "Provide an API key" instead of an invalid-key error — the first
 * points at `npm run console-key`, the second sends you looking for a typo.
 */
export async function withConsoleKey<T extends Record<string, string>>(
  headers: T,
): Promise<T> {
  const key = await consoleApiKey();
  if (key) (headers as Record<string, string>)["x-api-key"] = key;
  return headers;
}
