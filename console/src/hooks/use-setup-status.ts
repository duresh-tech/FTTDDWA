"use client";

import * as React from "react";
import {
  fetchSetupStatus,
  invalidateSetupStatus,
  type SetupStatus,
} from "@/lib/setup-status";

export { invalidateSetupStatus };
export type { SetupStatus };

/**
 * Whether this instance has completed first-run setup.
 *
 * `initialized === null` means "unknown" -- either still loading or the request
 * failed. Callers must NOT redirect on null: a backend hiccup would otherwise
 * bounce signed-in users into the installer.
 *
 * The request itself, its cache and its invalidation live in
 * `lib/setup-status.ts`, because the API clients need the console key out of
 * the same response and two caches of one endpoint would mean two requests
 * and two things to invalidate.
 */
export function useSetupStatus(): {
  initialized: boolean | null;
  status: SetupStatus | null;
} {
  const [status, setStatus] = React.useState<SetupStatus | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchSetupStatus()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        // Stays null -> unknown -> no redirect.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { initialized: status ? status.initialized : null, status };
}
