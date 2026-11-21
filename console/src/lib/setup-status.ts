import { getApiUrl } from "@/lib/runtime-config";

export interface SetupStatus {
  initialized: boolean;
  appName: string;
  logoPath: string | null;
  /**
   * The console's own API key, or null when there is no usable one.
   *
   * Served unauthenticated by design: the console is a public web app and
   * cannot hold a secret the browser does not see. A key states which
   * APPLICATION is calling — every console route still requires a session and
   * its permissions — so holding this grants nothing on its own.
   *
   * See `lib/console-key.ts` and docs/guide/api-keys.
   */
  consoleApiKey: string | null;
}

/**
 * First-run status, and the console's key, in one request.
 *
 * Cached in a module-level promise so the several entry points that gate on
 * this (both session providers, both login pages, and every API call through
 * `withConsoleKey`) share one request rather than racing.
 *
 * Deliberately a raw fetch rather than the api() client: api() needs the key
 * from here, and its 401 handler hard-redirects to /system/login, which would
 * fight the gate it feeds. `/system/setup/status` needs no key itself.
 */
let cached: Promise<SetupStatus> | null = null;

export function fetchSetupStatus(): Promise<SetupStatus> {
  cached ??= fetch(`${getApiUrl()}/system/setup/status`, {
    headers: { "x-device-type": "website" },
    cache: "no-store",
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Setup status failed (${response.status})`);
      return response.json() as Promise<SetupStatus>;
    })
    .catch((error) => {
      // Do not memoize a failure: let the next mount retry.
      cached = null;
      throw error;
    });
  return cached;
}

/**
 * Clears the cache.
 *
 * Called right after the wizard completes — which also picks up the console
 * key issued by it, since the first fetch happened on an uninitialized
 * instance and legitimately returned null.
 */
export function invalidateSetupStatus() {
  cached = null;
}
